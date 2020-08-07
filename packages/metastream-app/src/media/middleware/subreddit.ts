import { parse } from 'url'
import { encodeQueryParams } from 'utils/url'
import { IMediaMiddleware, MediaType, IMediaContext } from '../types'
import { fetchText } from 'utils/http'
import { MEDIA_REFERRER } from 'constants/http'

// https://www.reddit.com/dev/api/

const enum ObjectType {
  Comment = 't1',
  Account = 't2',
  Link = 't3',
  Message = 't4',
  Subreddit = 't5',
  Award = 't6'
}

const URL_PATTERN = /reddit\.com\/r\/([^\s/]+)\/?/i
const API_LIMIT = 5

const transformPost = ({ data }: any) => {
  let result: any = {
    id: data.id,
    url: data.url,
    title: `${data.title} - /r/${data.subreddit}`
  }

  const xpost = data.crosspost_parent_list

  // TODO: secure_media_embed
  if (data.media) {
    result.media = data.media
  }

  if (xpost && xpost.length > 0) {
    const parent = xpost[0]

    if (parent.url) {
      result.url = parent.url
    }

    if (parent.media) {
      result.media = parent.media
    }
  }

  return result
}

const getListing = async (url: string, after?: string) => {
  const urlobj = parse(url, true)

  const paramObj: { [key: string]: string | number } = {
    ...urlobj.query,
    limit: API_LIMIT
  }

  if (after) {
    paramObj.after = after
  }

  const params = encodeQueryParams(paramObj)

  // TODO: Keep GET params for filtering
  // TODO: Pick up from previous playlist state
  const apiUrl = `${urlobj.protocol}//${urlobj.hostname}${urlobj.pathname}.json?${params}`

  const [json] = await fetchText<any>(apiUrl, {
    headers: {
      Referer: MEDIA_REFERRER
    }
  })

  return json
}

const getNextPosts = (json: any) => {
  const posts = (json.data.children as any[]).filter(post => !post.data.stickied).map(transformPost)
  return posts
}

const parseItem = (ctx: IMediaContext, item: any): any => {
  ctx.res.title = item.title

  // Overwrite request url with subreddit post
  const url = new URL(item.url)
  if (url && url.href) {
    ctx.req.url = url
  }

  const { media } = item
  if (media) {
    if (media.reddit_video) {
      const v = media.reddit_video

      if (url && url.href) ctx.res.url = url.href

      const duration = v.duration * 1000
      if (duration) ctx.res.duration = duration

      return true
    } else if (media.oembed) {
      // Defer parse to oembed middleware
      // ctx.state.oEmbedJson = media.oembed
      return false
    }
  }

  return false
}

const mware: IMediaMiddleware = {
  match(url, ctx) {
    const isSubreddit = !!URL_PATTERN.exec(url.href)
    const isCommentThread = url.pathname ? url.pathname.includes('/comments/') : false
    return (isSubreddit && !isCommentThread) || !!(ctx.req.state && ctx.req.state.reddit)
  },

  async resolve(ctx, next) {
    const reqState = ctx.req.state

    let redditUrl
    let children: any[]
    let after
    let currentIdx

    // TODO: filter for API listings (/hot, /new, etc.)
    // https://www.reddit.com/dev/api/#section_listings
    if (reqState && reqState.reddit) {
      redditUrl = reqState.reddit.href
      children = reqState.reddit.children
      after = reqState.reddit.after
      currentIdx = reqState.reddit.idx
    } else {
      redditUrl = ctx.req.url.href
      const json = await getListing(redditUrl)
      console.log('Subreddit JSON', json)

      if (json.error) {
        console.debug('Error fetching subreddit posts')
        return next()
      }

      const posts = getNextPosts(json)

      if (posts.length === 0) {
        return next()
      }

      children = posts
      after = json.data.after
      currentIdx = -1
    }

    let idx = currentIdx + 1
    let child = children[idx]

    if (!child) {
      const json = await getListing(reqState!.reddit.href, reqState!.reddit.after)
      const posts = getNextPosts(json)

      if (posts.length === 0) {
        return next()
      }

      idx = 0
      children = posts
      child = children[idx]
      after = json.data.after

      if (!child) {
        return
      }
    }

    // Save pagination info for resolving next playlist item
    ctx.res.type = MediaType.Playlist
    ctx.res.hasMore = true
    ctx.res.state = {
      ...ctx.res.state,
      reddit: {
        ...(reqState || {}).reddit,
        href: redditUrl,
        idx,
        children,
        after
      }
    }

    if (!parseItem(ctx, child)) {
      await next()

      let title = child.title || ctx.res.title
      ctx.res.title = title
      return ctx.res
    }
  }
}

export default mware
