import { useState } from 'react'

type Period = 'Day' | 'Week' | 'Month'

interface Props {
  onSwitch: (s: 'statistics' | 'food') => void
}

export default function AdminStatistics({ onSwitch: _onSwitch }: Props) {
  const [period, setPeriod] = useState<Period>('Day')

  return (
    <div className="fade-in">
      <h2 className="text-2xl md:text-[1.6rem] font-bold text-[#1A1A1A] border-l-[6px] border-[#F7DC6F] pl-4 mb-6" style={{ fontFamily: 'serif' }}>
        Statistics
      </h2>

      {/* Donation Trends header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-[#1A1A1A]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
          Donation Trends
        </h3>
        <div className="flex flex-wrap gap-2">
          {(['Day', 'Week', 'Month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-colors ${
                period === p
                  ? 'bg-[#F7DC6F] border-[#F7DC6F] text-[#1A1A1A] hover:bg-[#F0C419]'
                  : 'bg-transparent border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm mb-8">
        <div className="bg-[#F7DC6F]/15 border-[1.5px] border-dashed border-[#F7DC6F] rounded-2xl h-[180px] flex items-center justify-center text-[#1A1A1A] text-sm gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
            <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
          </svg>
          Cash &amp; Goods donation — {period} view (demo)
        </div>
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top 5 */}
        <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-[#1A1A1A]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
              <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
            </svg>
            Top 5 Requested Packages
          </h3>
          <ol className="list-none space-y-0">
            {[
              ['Emergency Pack A', '147 requests'],
              ['Protein Pack B',   '112 requests'],
              ['Veggie Pack C',    '89 requests'],
              ['Pantry Pack D',    '65 requests'],
              ['Kids Nutrition Pack', '43 requests'],
            ].map(([name, count]) => (
              <li key={name} className="flex justify-between py-3 border-b border-dashed border-[#E8E8E8] last:border-0 text-[#1A1A1A]">
                <span>{name}</span>
                <span className="font-bold">{count}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Stock Gap */}
        <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm overflow-x-auto">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-[#1A1A1A]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
              <line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            Stock Gap Analysis
          </h3>
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr>
                {['Package','Forecast','Current','Gap'].map((h) => (
                  <th key={h} className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Emergency Pack A','60','8',  '-52',  true ],
                ['Protein Pack B',  '35','24', '-11',  true ],
                ['Veggie Pack C',   '20','3',  '-17',  true ],
                ['Pantry Pack D',   '25','33', '+8',   false],
              ].map(([name, forecast, current, gap, isDanger]) => (
                <tr key={String(name)}>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{name}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{forecast}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{current}</td>
                  <td className={`py-3 border-b border-[#E8E8E8] font-medium ${isDanger ? 'text-[#E63946]' : 'text-[#68CD52]'}`}>{gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-sm text-gray-500">* based on moving average</div>
        </div>
      </div>
    </div>
  )
}
