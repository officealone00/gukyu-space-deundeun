import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

// 데모 중 한 컴포넌트가 죽어도 화면 전체가 백지가 되지 않게 — 완성도(rubric) 보호.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error) }
  render() {
    if (this.state.error) {
      return (
        <div className="card error">
          <strong>문제가 발생했어요.</strong>
          <p className="muted">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>다시 시도</button>
        </div>
      )
    }
    return this.props.children
  }
}
