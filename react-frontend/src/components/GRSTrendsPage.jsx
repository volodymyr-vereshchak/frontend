import React from 'react';
import GRSTrends from './GRSTrends';
import './ReportPage.css';

export default function GRSTrendsPage() {
  return (
    <div className="report-page">
      <GRSTrends isOpen={true} onClose={() => {}} />
    </div>
  );
}
