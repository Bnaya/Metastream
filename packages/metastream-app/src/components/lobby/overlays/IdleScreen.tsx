import React from 'react'
import { connect } from 'react-redux'
import cx from 'classnames'
import styles from './IdleScreen.css'
import { HighlightButton } from 'components/common/button'
import { t } from 'locale'
import { setLobbyModal } from 'actions/ui'
import { LobbyModal } from 'reducers/ui'
import { IAppState } from 'reducers'
import { hasPlaybackPermissions } from 'lobby/reducers/mediaPlayer.helpers'

interface Props {
  className?: string
}

interface StateProps {
  isModalOpen: boolean
  dj: boolean
  queueLocked: boolean
}

interface DispatchProps {
  openMediaBrowser(): void
}

type PrivateProps = Props & StateProps & DispatchProps

const _IdleScreen = (props: PrivateProps) => {
  // Hide CTA while browser is open
  if (props.isModalOpen) return null

  const isAddAllowed = props.dj || !props.queueLocked

  const addMediaCTA = (
    <>
      <p>{t('addMediaCTA')}</p>
      <HighlightButton icon="plus" size="large" highlight onClick={props.openMediaBrowser}>
        {t('addMedia')}
      </HighlightButton>
    </>
  )

  return <div className={cx(styles.container, props.className)}>{isAddAllowed && addMediaCTA}</div>
}

export const IdleScreen = connect<StateProps, DispatchProps, Props, IAppState>(
  state => ({
    isModalOpen: Boolean(state.ui.lobbyModal),
    dj: hasPlaybackPermissions(state),
    queueLocked: state.mediaPlayer.queueLocked
  }),
  (dispatch): DispatchProps => ({
    openMediaBrowser() {
      dispatch(setLobbyModal(LobbyModal.Browser))
    }
  })
)(_IdleScreen)
