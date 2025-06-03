import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PortfolioEquityChart } from '../PortfolioEquityChart'; // Adjust path as necessary
import { getPortfolioEquityHistory } from '@/lib/api'; // Adjust path as necessary
import { PortfolioHistoryResponse, EquityDataPoint, ProfitabilityDetails } from '@/lib/types'; // Adjust path

// Mock the API module
jest.mock('@/lib/api');

const mockGetPortfolioEquityHistory = getPortfolioEquityHistory as jest.MockedFunction<typeof getPortfolioEquityHistory>;

const mockEquityDataPoint = (date: string, value: number): EquityDataPoint => ({ date, value });

const mockProfitability: ProfitabilityDetails = {
  absolute: 1200,
  percentage: 10.5,
  initial_portfolio_value: 10000,
  final_portfolio_value: 11200,
  cash_invested_in_period: 500,
  cash_returned_in_period: 100,
  net_investment_change: 400,
};

const mockApiResponse = (equityCurveData: EquityDataPoint[]): PortfolioHistoryResponse => ({
  equity_curve: equityCurveData,
  profitability: mockProfitability,
});

describe('PortfolioEquityChart', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGetPortfolioEquityHistory.mockReset();
  });

  test('1. Initial Render and Default Period Load (12M)', async () => {
    const mockData = mockApiResponse([
      mockEquityDataPoint('2023-01-01', 10000),
      mockEquityDataPoint('2023-12-31', 11200),
    ]);
    mockGetPortfolioEquityHistory.mockResolvedValue(mockData);

    render(<PortfolioEquityChart />);

    // Verify loading state (might be too fast to catch, but good to have)
    expect(screen.getByText(/Carregando dados.../i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      // Chart title
      expect(screen.getByText(/Evolução da Carteira/i)).toBeInTheDocument();
      // Period buttons
      expect(screen.getByRole('button', { name: /12M/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /6M/i })).toBeInTheDocument();
      
      // Check for chart elements (presence of SVG is a good indicator)
      // Note: specific Recharts class names might be brittle
      expect(screen.getByRole('graphics-document')).toBeInTheDocument(); // Generic role for SVG/chart container
    });
    
    // Check profitability figures (example)
    // Formatting needs to be considered, this checks for parts of the string
    expect(await screen.findByText(/Rentabilidade no Período:/i)).toBeInTheDocument();
    expect(await screen.findByText(/R\$ 1\.200,00/i)).toBeInTheDocument(); // Check formatted absolute value
    expect(await screen.findByText(/\(10,50%\)/i)).toBeInTheDocument(); // Check formatted percentage

    // Verify API was called with default period (12M)
    // The calculateDates for "12m" would be called internally.
    // We can check if it was called once as an approximation here.
    expect(mockGetPortfolioEquityHistory).toHaveBeenCalledTimes(1);
    // More specific check on arguments would require knowing exact date calculations or mocking date-fns
  });

  test('2. Period Selection Change (e.g., to 6M)', async () => {
    const initialMockData = mockApiResponse([mockEquityDataPoint('2023-01-01', 10000)]);
    const sixMonthsMockData = mockApiResponse([mockEquityDataPoint('2023-07-01', 10500)]);
    
    mockGetPortfolioEquityHistory.mockResolvedValueOnce(initialMockData); // For initial 12M load
    
    render(<PortfolioEquityChart />);
    
    // Wait for initial load to complete
    await waitFor(() => expect(mockGetPortfolioEquityHistory).toHaveBeenCalledTimes(1));

    // Setup mock for the 6M period call
    mockGetPortfolioEquityHistory.mockResolvedValueOnce(sixMonthsMockData);

    // Simulate click on "6M" button
    fireEvent.click(screen.getByRole('button', { name: /6M/i }));

    // Verify loading state appears after click (if component shows it before new data)
    // This might depend on implementation details of loading state visibility during updates.
    // For now, we'll wait for the API call.

    await waitFor(() => {
      // API should be called a second time (for the 6M period)
      expect(mockGetPortfolioEquityHistory).toHaveBeenCalledTimes(2);
      // We'd ideally check the arguments for the second call here.
      // For example: expect(mockGetPortfolioEquityHistory.mock.calls[1][0]).toEqual(expected_6M_start_date_str);
    });

    // Verify chart/profitability updates (e.g., a value from the new mock data)
    // This depends on the mock data for 6M being distinct.
    // For simplicity, we just check if the component doesn't crash and API was called.
    // A more robust test would check for specific values from sixMonthsMockData in the DOM.
    expect(await screen.findByText(/R\$ 10\.500,00/i)).toBeInTheDocument(); // Assuming this value is unique to 6M mock
  });

  test('3. Loading State Display', async () => {
    mockGetPortfolioEquityHistory.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockApiResponse([])), 300))
    );

    render(<PortfolioEquityChart />);
    
    expect(screen.getByText(/Carregando dados.../i)).toBeInTheDocument();
    await waitFor(() => {
      // After loading, the "no data" message might appear if mock is empty, or chart if data
      expect(screen.queryByText(/Carregando dados.../i)).not.toBeInTheDocument();
    }, { timeout: 500 }); // Wait a bit longer than the mock delay
  });

  test('4. Error State Display', async () => {
    const errorMessage = "API Error: Failed to fetch data";
    mockGetPortfolioEquityHistory.mockRejectedValueOnce(new Error(errorMessage));

    render(<PortfolioEquityChart />);

    await waitFor(() => {
      expect(screen.getByText(`Erro: ${errorMessage}`)).toBeInTheDocument();
    });
  });
  
  test('5. No Data State Display', async () => {
    const noDataResponse = mockApiResponse([]); // Empty equity curve
    mockGetPortfolioEquityHistory.mockResolvedValue(noDataResponse);

    render(<PortfolioEquityChart />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum dado disponível para o período selecionado./i)).toBeInTheDocument();
    });
    // Ensure profitability section also handles no data gracefully (e.g., not displayed or shows defaults)
    // The current component structure hides profitability if no chartData.
    expect(screen.queryByText(/Rentabilidade no Período:/i)).not.toBeInTheDocument();
  });

});

// Helper to format currency for consistent checking (example)
// const formatCurrencyForTest = (value: number) =>
//   new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Example of how to check API call arguments more precisely:
// const today = new Date(2024, 2, 15); // Mock current date if needed for consistent date calcs
// jest.useFakeTimers().setSystemTime(today);
// ... later in test ...
// const expectedStartDateFor6M = format(subMonths(endOfDay(today), 6), "yyyy-MM-dd");
// const expectedEndDateFor6M = format(endOfDay(today), "yyyy-MM-dd");
// expect(mockGetPortfolioEquityHistory.mock.calls[1]).toEqual([expectedStartDateFor6M, expectedEndDateFor6M, 'daily']);
// jest.useRealTimers(); // Clean up
