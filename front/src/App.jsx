import { useState, useEffect } from 'react'

function App() {
  const [website, setWebsite] = useState('https://revyl.ai')
  const [requestId, setRequestId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [requiredFields, setRequiredFields] = useState([])
  const [fieldValues, setFieldValues] = useState({})
  const [ws, setWs] = useState(null)

  function startWebSocket() {
    const ws = new WebSocket('ws://localhost:3000')
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.route === 'request') {
        setRequestId(data.body.request_id)
      }
      if (data.route === 'result') {
        setRequiredFields(data.body.requiredFields)
        setStatus('blocked')
      }
      if (data.route === 'stdout') {
        console.log(data.body)
      }
    }
    setWs(ws)
  }

  // Fetch profiles when sidebar is opened
  useEffect(() => {
      startWebSocket()
  }, [])

  // Function to submit a new request
  const submitRequest = async () => {
    try {
      ws.send(JSON.stringify({
        route: 'request',
        body: {
          website_url: website,
          user_id: 'test-user',
        }
      }))
      setStatus('pending')
    } catch (err) {
      setError(err.message)
    }
  }

  // Function to handle field value changes
  const handleFieldChange = (field) => (e) => {
    setFieldValues(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gray-900 relative">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-[url('/library.png')] flex items-center justify-center">
      <div className="max-w-md w-full p-4 bg-gray-300/20 border-1 border-black backdrop-blur-sm rounded-md shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-black text-left">Let AI book a demo for you</h1>
        </div>

        <div className="space-y-2">
          <div className="flex flex-row gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://revyl.ai"
                className="w-full px-4 py-2 border-1 border-black placeholder:text-gray-400 text-black rounded-md focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,151,54,0.3)] focus:shadow-[0_0_20px_rgba(255,151,54,0.5)]"
              />
            </div>
            <button
              onClick={submitRequest}
              disabled={status === 'pending'}
              className="w-32 cursor-pointer py-2 px-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(247,151,54,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(() => {
                switch(status) {
                  case 'pending':
                    return 'Processing...';
                  case 'blocked':
                    return 'Resubmit';
                  case 'complete':
                    return 'Done!';
                  default:
                    return 'Book a demo';
                }
              })()}
            </button>
          </div>

          {/* Status and Error Display */}
          {error && (
            <div className="text-red-500 text-sm mt-2">
              Error: {error}
            </div>
          )}

          {status && (
            <div className="text-white text-sm mt-2">
              Status: {status}
            </div>
          )}

          {/* Required Fields Form */}
          {requiredFields.length > 0 && (
            <div className="mt-4 p-4 border-1 border-black rounded-md">
              <h2 className="text-black font-semibold mb-2">Required Fields</h2>
              <div className="space-y-3">
                {requiredFields.map((field) => (
                  <div key={field}>
                    <label className="block text-black text-md mb-1">{field}</label>
                    <input
                      type="text"
                      value={fieldValues[field] || ''}
                      onChange={handleFieldChange(field)}
                      className="w-full px-4 py-2 text-black rounded-md border-1 border-black focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  )
}

export default App
