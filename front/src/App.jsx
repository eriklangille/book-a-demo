import { useState, useEffect, useCallback, useRef } from 'react'

function App() {
  const [website, setWebsite] = useState('http://localhost:8000/test.html')
  const [requestId, setRequestId] = useState(null)
  const [profileId, setProfileId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [requiredFields, setRequiredFields] = useState([])
  const [fieldValues, setFieldValues] = useState({})
  const [ws, setWs] = useState(null)
  const [stdoutMessages, setStdoutMessages] = useState([])
  const [activeTab, setActiveTab] = useState('output')
  const stdoutRef = useRef(null)
  const messagesRef = useRef([])

  const timeoutId = useRef(null);

  // Create a debounced function to send field updates
  const debouncedSendField = useCallback((field, value) => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          route: 'fields',
          body: {
            profile_id: profileId,
            field_key: field,
            user_id: 'test-user',
            field_value: value
          }
        }));
      }
    }, 1000);
  }, [ws, profileId]);

  function startWebSocket() {
    const ws = new WebSocket('ws://localhost:3000')
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.route === 'request') {
        if (data.error) {
          setError(data.error)
        } else {
          setRequestId(data.body.request_id)
          setProfileId(data.body.profile_id)
        }
      }
      if (data.route === 'result') {
        if (data.body.result) {
          setStatus('complete')
        } else {
          setRequiredFields(data.body.requiredFields)
          setActiveTab('fields')
          setStatus('blocked')
        }
      }
      if (data.route === 'stdout') {
        messagesRef.current = [...messagesRef.current, data.body];
        setStdoutMessages(messagesRef.current);
      }
    }
    setWs(ws)
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (stdoutRef.current) {
      stdoutRef.current.scrollTop = stdoutRef.current.scrollHeight;
    }
  }, [stdoutMessages]);

  // Fetch profiles when sidebar is opened
  useEffect(() => {
      startWebSocket()
  }, [])

  // Function to submit a new request
  const submitRequest = async () => {
    if (requiredFields.length > 0) {
      for (const field of requiredFields) {
        if (!fieldValues[field]) {
          setError(`Please fill in ${field}`)
          return
        }
      }
    }
    try {
      ws.send(JSON.stringify({
        route: 'request',
        body: {
          website_url: website,
          request_id: requestId,
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
    const newValue = e.target.value;
    setFieldValues(prev => ({
      ...prev,
      [field]: newValue
    }));
    debouncedSendField(field, newValue);
  }

  return (
    <div className="min-h-screen bg-gray-900 relative">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-[url('/library.png')] flex items-center justify-center">
      <div className="max-w-md w-full p-4 bg-gray-300/20 border-1 border-black backdrop-blur-sm rounded-md shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold font-[Bodoni_Moda] text-black text-left">Let AI book a demo for you</h1>
        </div>

        <div className="space-y-2">
          <div className="flex flex-row gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                // placeholder="https://revyl.ai"
                placeholder="http://localhost:8000/test.html"
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

          {/* {status && (
            <div className="text-white text-sm mt-2">
              Status: {status}
            </div>
          )} */}

          {/* Combined Fields and Output Display */}
          {status && (
            <div className="h-[290px]">
              {/* Tabs */}
              <div className="flex space-x-2 mb-4">
                {requiredFields.length > 0 && (
                  <button
                    onClick={() => setActiveTab('fields')}
                    className={`cursor-pointer px-4 py-2 text-sm font-semibold transition-colors relative ${
                      activeTab === 'fields'
                        ? 'text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-black'
                        : 'text-gray-800 hover:text-black'
                    }`}
                  >
                    Required Fields
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('output')}
                  className={`cursor-pointer px-4 py-2 text-sm font-semibold transition-colors relative ${
                    activeTab === 'output'
                      ? 'text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-black'
                      : 'text-gray-800 hover:text-black'
                  }`}
                >
                  Output
                </button>
              </div>

              {/* Content */}
              <div className={`relative mt-4 p-4 border-1 border-black rounded-md ${activeTab === 'fields' ? 'bg-transparent backdrop-blur-sm' : 'bg-gray-900/50 backdrop-blur-sm'}`}>
                {activeTab === 'fields' && requiredFields.length > 0 && (
                  <div className="space-y-3">
                    {requiredFields.map((field) => (
                      <div key={field}>
                        <label className="block text-black text-md mb-1">{field}</label>
                        <input
                          type="text"
                          value={fieldValues[field] || ''}
                          onChange={handleFieldChange(field)}
                          className="w-full px-4 py-2 text-black rounded-md border-1 border-black focus:ring-2 focus:ring-orange-500 focus-visible:ring-2 focus-visible:outline-none focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'output' && (
                  <div 
                    ref={stdoutRef}
                    style={{
                      maxHeight: '200px',
                      height: '200px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      willChange: 'transform',
                      transform: 'translateZ(0)',
                      scrollBehavior: 'smooth'
                    }}
                    key={stdoutMessages.length} // Add a key to force re-render
                  >
                    <div className="space-y-1 min-w-max">
                      {stdoutMessages.map((message, index) => (
                        <div key={`${index}-${message}`} className="text-white text-xs font-mono whitespace-pre">
                          {message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
