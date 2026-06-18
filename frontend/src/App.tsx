import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import OrderDetail from './pages/OrderDetail';

export default function App() {
  return (
    <div className="container">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
      </Routes>
    </div>
  );
}
