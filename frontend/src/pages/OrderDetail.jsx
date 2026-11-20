import React from 'react';
import { useParams } from 'react-router-dom';

export default function OrderDetail() {
  const { id } = useParams();
  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold font-mono text-slate-200">Order Detail: {id} (Step 3)</h1>
    </div>
  );
}
