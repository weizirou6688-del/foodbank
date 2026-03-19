import { useState } from 'react'

type Tab = 'packages' | 'items'

interface Props {
  onSwitch: (s: 'statistics' | 'food') => void
}

const PACKAGES = [
  { name: 'Emergency Pack A', category: 'Meat & Prepared',            threshold: 15, stock: 8,  contents: ['Beef can x2','Chicken can x1','Energy bar x3'], warn: true  },
  { name: 'Protein Pack B',   category: 'Meat & Prepared',            threshold: 10, stock: 24, contents: ['Chicken can x3','Tuna can x2'],                  warn: false },
  { name: 'Veggie Pack C',    category: 'Fresh Vegetables & Staples', threshold: 8,  stock: 3,  contents: ['Potato 5kg','Carrot 3kg','Onion 2kg'],            warn: true  },
  { name: 'Pantry Pack D',    category: 'Pantry & Spices',            threshold: 20, stock: 33, contents: ['Oil 1L','Salt 2pkt','Pasta 3pkt'],                warn: false },
]

const CATEGORIES = [
  {
    name: 'Proteins & Meat',
    items: [
      { name: 'Beef Cans',    stock: 22,  unit: 'can',  threshold: 30, warn: true  },
      { name: 'Chicken Cans', stock: 89,  unit: 'can',  threshold: 25, warn: false },
      { name: 'Tuna Cans',    stock: 14,  unit: 'can',  threshold: 15, warn: true  },
    ],
  },
  {
    name: 'Carbohydrates & Grains',
    items: [
      { name: 'Rice',  stock: 430, unit: 'kg',   threshold: 100, warn: false },
      { name: 'Pasta', stock: 45,  unit: 'pack', threshold: 50,  warn: true  },
    ],
  },
]

const ActionBtns = () => (
  <div className="flex gap-2">
    <button className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">Edit</button>
    <button className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">In</button>
    <button className="px-3 py-1.5 border-[1.5px] border-[#E63946] text-[#E63946] rounded-full text-xs font-medium hover:bg-[#E63946]/5 bg-transparent">Out</button>
  </div>
)

export default function AdminFoodManagement({ onSwitch: _onSwitch }: Props) {
  const [tab, setTab] = useState<Tab>('packages')
  const [search, setSearch] = useState('')

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0)

  return (
    <div className="fade-in">
      <h2 className="text-2xl md:text-[1.6rem] font-bold text-[#1A1A1A] border-l-[6px] border-[#F7DC6F] pl-4 mb-8" style={{ fontFamily: 'serif' }}>
        Food Management
      </h2>

      {/* Inner tabs */}
      <div className="flex gap-4 mb-8 border-b-[1.5px] border-[#E8E8E8] pb-2 overflow-x-auto">
        <button
          onClick={() => setTab('packages')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'packages' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
          </svg>
          Food Packages
        </button>
        <button
          onClick={() => setTab('items')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'items' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
          Single Items
        </button>
      </div>

      {/* Food Packages tab */}
      {tab === 'packages' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-[#1A1A1A]">Food Package List</h3>
            <button className="bg-[#F7DC6F] hover:bg-[#F0C419] text-[#1A1A1A] px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border-[1.5px] border-[#F7DC6F]">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              New Package
            </button>
          </div>

          <div className="overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F5F5F5]">
                  {['Package name','Category','Safety threshold','Current stock','Contents','Actions'].map((h) => (
                    <th key={h} className="p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((pkg) => (
                  <tr key={pkg.name} className={`border-b border-[#E8E8E8] ${pkg.warn ? 'bg-[#E63946]/[0.08]' : ''}`}>
                    <td className="p-4 text-[#1A1A1A]">{pkg.name}</td>
                    <td className="p-4 text-[#1A1A1A]">{pkg.category}</td>
                    <td className="p-4 text-[#1A1A1A]">{pkg.threshold}</td>
                    <td className="p-4 text-[#1A1A1A]">{pkg.stock}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {pkg.contents.map((c) => (
                          <span key={c} className="bg-[#F5F5F5] border border-[#E8E8E8] rounded-full px-3 py-1 text-xs text-[#1A1A1A] whitespace-nowrap">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4"><ActionBtns /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Items tab */}
      {tab === 'items' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
            <button className="bg-[#F7DC6F] hover:bg-[#F0C419] text-[#1A1A1A] px-5 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-colors border-[1.5px] border-[#F7DC6F] w-full sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              New Item
            </button>
            <div className="flex items-center border-[1.5px] border-[#E8E8E8] rounded-full px-4 h-12 bg-white w-full sm:w-[300px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mr-2 shrink-0">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#1A1A1A] w-full text-sm"
              />
            </div>
          </div>

          {filteredCategories.map((cat) => (
            <div key={cat.name} className="mb-8">
              <div className="flex items-center gap-2 text-xl font-bold text-[#1A1A1A] py-3 border-b-2 border-[#F7DC6F] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
                {cat.name}
              </div>
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b-2 border-[#E8E8E8] font-semibold text-gray-600 text-sm">
                <span>Name</span><span>Stock</span><span>Unit</span><span>Threshold</span><span>Actions</span>
              </div>
              {cat.items.map((item) => (
                <div
                  key={item.name}
                  className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b border-[#E8E8E8] gap-4 md:gap-0 ${item.warn ? 'bg-[#E63946]/[0.08] -mx-4 px-4 md:mx-0 md:px-0' : ''}`}
                >
                  <span className="font-medium text-[#1A1A1A]">{item.name}</span>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Stock:</span>
                    <span className={item.warn ? 'text-[#E63946] font-semibold' : ''}>{item.stock}</span>
                  </div>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Unit:</span> {item.unit}
                  </div>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Threshold:</span> {item.threshold}
                  </div>
                  <div className="mt-2 md:mt-0"><ActionBtns /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
