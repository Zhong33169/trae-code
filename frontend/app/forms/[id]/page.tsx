'use client';

import Header from '../../components/Header';
import FormDetail from '../../components/FormDetail';

export default function FormDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Header />
      <main className="main-content">
        <div className="container">
          <FormDetail formId={params.id} />
        </div>
      </main>
    </div>
  );
}
