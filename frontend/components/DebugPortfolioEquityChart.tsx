import React from 'react';

const DebugPortfolioEquityChart = ({ shouldLoad = true }) => {
  console.log('DebugPortfolioEquityChart rendered with shouldLoad:', shouldLoad);
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Debug: Portfolio Equity Chart</h3>
      <p>Component loaded successfully</p>
      <p>shouldLoad: {shouldLoad ? 'true' : 'false'}</p>
    </div>
  );
};

export default DebugPortfolioEquityChart;
