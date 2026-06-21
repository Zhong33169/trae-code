import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { App } from './App';
import { LoginPage } from './pages/Login';
import { EventsPage } from './pages/Events';
import { EventDetailPage } from './pages/EventDetail';
import { CreateEventPage } from './pages/CreateEvent';
import { ScanPage } from './pages/Scan';
import { BatchPage } from './pages/Batch';
import { StatisticsPage } from './pages/Statistics';
import { AuditPage } from './pages/Audit';
import './index.css';

const root = document.getElementById('root');

render(
  () => (
    <Router root={App}>
      <Route path="/login" component={LoginPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/new" component={CreateEventPage} />
      <Route path="/events/:id" component={EventDetailPage} />
      <Route path="/scan" component={ScanPage} />
      <Route path="/batch" component={BatchPage} />
      <Route path="/statistics" component={StatisticsPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="*" component={LoginPage} />
    </Router>
  ),
  root!
);
