import React, { Component } from 'react'
import { Store } from 'redux'
import { Provider } from 'react-redux'
import { History } from 'history'
import { ConnectedRouter } from 'connected-react-router'
import Routes from '../routes'
import { IAppState } from '../reducers'
import { PersistGate } from 'redux-persist/integration/react'
import { Persistor } from 'redux-persist'
import { ErrorBoundary } from 'components/ErrorBoundary'
import { AppContext } from 'appContext'

interface IProps {
  store: Store<IAppState>
  history: History
  persistor: Persistor
}

export default class Root extends Component<IProps> {
  render() {
    const { store, history, persistor } = this.props
    return (
      <ErrorBoundary>
        <Provider store={store}>
          <PersistGate persistor={persistor}>
            <ConnectedRouter history={history}>
              <Routes />
            </ConnectedRouter>
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    )
  }
}
