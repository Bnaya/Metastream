import React, { Component } from 'react'
import cx from 'classnames'
import styles from './Slider.css'
import { clamp } from 'utils/math'
import { CuePointItem, CuePoint } from 'components/media/CuePoint'
import { isFirefox } from '../../utils/browser'

/** px */
const CUE_GRAVITATE_THRESHOLD = 8

interface IProps {
  className?: string
  progressBarClassName?: string

  value: number
  max?: number

  cuePoints?: Readonly<CuePointItem>[]

  /** Listen for mouse hover */
  hover?: boolean

  /** Allow scrolling */
  scroll?: boolean

  /** Emit change event upon first drag event. */
  changeOnStart?: boolean

  onChange?: (value: number) => void

  onDragStart?: () => void
  onDrag?: (value: number) => void
  onDragEnd?: () => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
}

interface IState {
  hovering?: boolean
  dragging?: boolean
  cursorProgress?: number
  cuePoints?: Readonly<CuePointItem>[]
  activeCuePointIndex?: number
}

export class Slider extends Component<IProps> {
  static defaultProps: Partial<IProps> = {
    max: 1,
    changeOnStart: false
  }

  state: IState = {}

  private rootEl: HTMLElement | null = null
  private preventClick?: boolean

  componentDidMount(): void {
    if (this.rootEl) {
      if (this.props.scroll) {
        this.rootEl.addEventListener('wheel', this.onMouseWheel, false)
      }
      if (this.props.hover) {
        this.rootEl.addEventListener('mouseenter', this.onHoverStart, false)
      }
    }
  }

  componentWillUnmount(): void {
    if (this.rootEl) {
      if (this.props.scroll) {
        this.rootEl.removeEventListener('wheel', this.onMouseWheel, false)
      }

      if (this.props.hover) {
        this.rootEl.removeEventListener('mouseenter', this.onHoverStart, false)
      }
    }

    if (this.state.dragging) {
      this.onDragEnd()
    }
  }

  /** Filter and sort cue points for efficient searching */
  private processCuePoints(cuePoints: CuePointItem[]) {
    const results = cuePoints.filter(({ value }) => !isNaN(value) && value >= 0 && value <= 1)

    if (results.length === 0) {
      return
    }

    results.sort((a, b) => {
      if (a.value > b.value) {
        return 1
      } else if (a.value < b.value) {
        return -1
      } else {
        return 0
      }
    })

    return results
  }

  componentWillReceiveProps(nextProps: IProps): void {
    const { cuePoints } = nextProps
    if (cuePoints !== this.props.cuePoints) {
      this.setState({
        cuePoints: cuePoints && this.processCuePoints(cuePoints)
      })
    }
  }

  private renderCuePoints(): JSX.Element[] | undefined {
    const { cuePoints, activeCuePointIndex } = this.state
    if (!cuePoints) {
      return
    }

    const children = cuePoints.map((cue, idx) => {
      const p = clamp(cue.value, 0, 1)
      const style = {
        left: `${p * 100}%`
      }
      return <CuePoint key={idx} value={cue} active={idx === activeCuePointIndex} style={style} />
    })

    return children
  }

  render(): JSX.Element | null {
    const { dragging, cursorProgress } = this.state
    const progress =
      dragging && typeof cursorProgress === 'number'
        ? cursorProgress
        : clamp(this.props.value, 0, 1)

    const progressStyle = {
      width: `${progress * 100}%`
    }

    const knobStyle = {
      left: `${progress * 100}%`
    }

    return (
      <div
        ref={el => {
          this.rootEl = el
        }}
        className={cx(this.props.className, styles.progress)}
        onClick={this.onClick}
        onMouseDown={this.onDragStart}
      >
        <div className={styles.progressTrack}>
          <div
            className={cx(styles.progressBar, this.props.progressBarClassName)}
            style={progressStyle}
          />
          <button
            type="button"
            className={cx(styles.knob, { active: this.state.dragging })}
            style={knobStyle}
          />
          {this.renderCuePoints()}
        </div>
      </div>
    )
  }

  private findClosestCuePointIndex(value: number) {
    const cuePoints = this.state.cuePoints

    if (!cuePoints || cuePoints.length === 0) {
      return
    }

    // TODO: assert(len !== 0)
    // TODO: assert(isSorted(cuePoints))

    const len = cuePoints.length
    let a = cuePoints
    let lo = 0
    let hi = len - 1

    while (lo <= hi) {
      let mid = Math.floor((hi + lo) / 2)

      if (value < a[mid].value) {
        hi = mid - 1
      } else if (value > a[mid].value) {
        lo = mid + 1
      } else {
        return mid
      }
    }

    // lo == hi + 1
    let lov = lo >= 0 && lo < len ? a[lo].value : Infinity
    let hiv = hi >= 0 && hi < len ? a[hi].value : Infinity
    const cp = lov - value < value - hiv ? lo : hi
    const result = a[cp] ? cp : (a[lo] && lo) || (a[hi] && hi)
    return result
  }

  /** Nudge progress to cue points */
  private maybeGravitate(
    cue: Readonly<CuePointItem>,
    x: number,
    width: number
  ): number | undefined {
    const cx = cue.value * width
    const dx = Math.abs(x - cx)

    return dx <= CUE_GRAVITATE_THRESHOLD ? cue.value : undefined
  }

  /**
   * Calculate progress and update related state.
   *
   * Shows cue point tooltips.
   */
  private updateProgress(
    event: { pageX: number; altKey: boolean },
    fireChange: boolean = true
  ): number {
    const { rootEl } = this
    if (!rootEl) {
      return 0
    }

    const bbox = rootEl.getBoundingClientRect()
    const width = bbox.width
    const x = event.pageX - bbox.left
    let progress = clamp(x / (width || 1), 0, 1)

    {
      const cueIdx = this.findClosestCuePointIndex(progress)

      if (typeof cueIdx === 'number') {
        const { activeCuePointIndex } = this.state

        // Attempt to gravitate progress towards closest cue point
        const cue = this.state.cuePoints![cueIdx]
        const gravityProgress = this.maybeGravitate(cue, x, width)
        const didGravitate = typeof gravityProgress === 'number'

        if (didGravitate) {
          if (activeCuePointIndex !== cueIdx) {
            this.setState({ activeCuePointIndex: cueIdx })
          }

          if (!event.altKey) {
            progress = gravityProgress!
          }
        } else if (typeof activeCuePointIndex === 'number') {
          this.setState({ activeCuePointIndex: undefined })
        }
      }
    }

    if (fireChange && this.props.onChange) {
      this.props.onChange(progress)
    }

    return progress
  }

  private clearActiveCuePoint() {
    this.setState({ activeCuePointIndex: undefined })
  }

  private onClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()

    if (this.preventClick) {
      this.preventClick = undefined
      return
    }

    if (this.state.dragging) {
      return
    }

    this.updateProgress(event)
  }

  private onMouseMove = (event: MouseEvent) => {
    const progress = this.updateProgress(event, false)
    this.setState({ cursorProgress: progress })

    if (this.state.dragging && this.props.onDrag) {
      this.props.onDrag(progress)
    }
  }

  private onDragStart = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()

    const progress = this.updateProgress(event, this.props.changeOnStart)
    this.setState({ dragging: true, cursorProgress: progress })

    if (!this.state.hovering) {
      document.addEventListener('mousemove', this.onMouseMove, false)
    }
    document.addEventListener('mouseup', this.onDragEnd, false)

    if (this.props.onDragStart) {
      this.props.onDragStart()
    }
  }

  private onDragEnd = (event?: MouseEvent) => {
    if (!this.state.hovering) {
      document.removeEventListener('mousemove', this.onMouseMove, false)
    }
    document.removeEventListener('mouseup', this.onDragEnd, false)

    if (this.props.onChange && typeof this.state.cursorProgress === 'number') {
      this.props.onChange(this.state.cursorProgress)
    }

    this.setState({ dragging: false, cursorProgress: undefined })

    if (!this.state.hovering) {
      this.clearActiveCuePoint()
    }

    if (this.props.onDragEnd) {
      this.props.onDragEnd()
    }

    if (event && event.target && this.rootEl) {
      const target = event.target as HTMLElement
      if (target === this.rootEl || target.contains(this.rootEl)) {
        this.preventClick = true
      }
    }
  }

  private onMouseWheel = (event: MouseWheelEvent) => {
    event.preventDefault()
    if (!this.props.onChange) return

    const dt = event.deltaY || event.deltaX
    const dir = dt === 0 ? 0 : dt > 0 ? -1 : 1

    // Allow smoother scrolling on finer touchpads
    const multiplier = isFirefox() ? 1 / 3 : 0.01

    const delta = 0.05 * Math.abs(dt) * multiplier
    const value = this.props.value + delta * dir
    this.props.onChange(value)
  }

  private onHoverStart = (event: MouseEvent) => {
    const progress = this.updateProgress(event, this.props.changeOnStart)
    this.setState({ hovering: true, cursorProgress: progress })

    if (this.rootEl) {
      if (!this.state.dragging) {
        document.addEventListener('mousemove', this.onMouseMove, false)
      }
      this.rootEl.addEventListener('mouseleave', this.onHoverEnd, false)
    }

    if (this.props.onHoverStart) {
      this.props.onHoverStart()
    }
  }

  private onHoverEnd = () => {
    if (this.rootEl) {
      if (!this.state.dragging) {
        document.removeEventListener('mousemove', this.onMouseMove, false)
      }
      this.rootEl.removeEventListener('mouseleave', this.onHoverEnd, false)
    }

    this.setState({ hovering: false })

    if (!this.state.dragging) {
      this.clearActiveCuePoint()
    }

    if (this.props.onHoverEnd) {
      this.props.onHoverEnd()
    }
  }
}
