import React from 'react';
import NightConsumption from './NightConsumption';
import './ReportPage.css';

export default function NightConsumptionPage() {
  return (
    <div className="report-page">
      <NightConsumption isOpen={true} onClose={() => {}} />
    </div>
  );
}
