import { useState } from 'react'

function App() {
  const [website, setWebsite] = useState('https://revyl.ai')

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full p-4 bg-gray-800 rounded-md shadow-2xl">
        <h1 className="text-2xl font-semibold text-white mb-6 text-left">test the demo booking flow for your website.</h1>
        <div className="space-y-4 flex flex-row gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://revyl.ai"
              className="w-full px-4 py-2 bg-gray-700 placeholder:text-gray-400 text-white rounded-md border-2 border-transparent focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-300 hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] focus:shadow-[0_0_20px_rgba(147,51,234,0.5)]"
            />
          </div>
          <button
            onClick={() => console.log('Booking demo for:', website)}
            className="w-32 cursor-pointer py-2 px-2 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 transform hover:scale-105"
          >
            book a demo
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
