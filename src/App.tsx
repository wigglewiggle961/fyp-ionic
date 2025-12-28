import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { home, moon, alarm } from 'ionicons/icons';
import Home from './pages/Home';
import SleepPage from './pages/SleepPage';
import AlarmPage from './pages/AlarmPage';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/home">
            <Home />
          </Route>
          <Route exact path="/sleep">
            <SleepPage />
          </Route>
          <Route exact path="/alarm">
            <AlarmPage />
          </Route>
          <Route exact path="/">
            <Redirect to="/home" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom" style={{ background: '#121212', borderTop: '1px solid #333' }}>
          <IonTabButton tab="home" href="/home" style={{ background: '#121212' }}>
            <IonIcon aria-hidden="true" icon={home} />
            <IonLabel>Summary</IonLabel>
          </IonTabButton>
          <IonTabButton tab="sleep" href="/sleep" style={{ background: '#121212' }}>
            <IonIcon aria-hidden="true" icon={moon} />
            <IonLabel>Sleep</IonLabel>
          </IonTabButton>
          <IonTabButton tab="alarm" href="/alarm" style={{ background: '#121212' }}>
            <IonIcon aria-hidden="true" icon={alarm} />
            <IonLabel>Alarm</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  </IonApp>
);

export default App;
