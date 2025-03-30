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
  const [activeTab, setActiveTab] = useState('logging')
  const [result, setResult] = useState(null)
  const stdoutRef = useRef(null)
  const messagesRef = useRef([])

  const timeoutId = useRef(null);

  // Function to cancel the current request
  const cancelRequest = () => {
    if (ws && ws.readyState === WebSocket.OPEN && requestId) {
      ws.send(JSON.stringify({
        route: 'cancel',
        body: {
          request_id: requestId,
          user_id: 'test-user'
        }
      }));
      setStatus(null);
      setRequestId(null);
      setError(null);
    }
  };

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
          setResult(data.body.result)
          setActiveTab('result')
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
    if (status === 'complete') return;
    if (requiredFields.length > 0) {
      for (const field of requiredFields) {
        if (!fieldValues[field.field_name]) {
          setError(`Please fill in ${field.field_name}`)
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
      <div className={`w-md min-w-[300px] p-4 bg-gray-300/20 border-1 border-black backdrop-blur-sm rounded-md shadow-2xl relative z-10 ${status ? 'resize' : ''} overflow-auto`} style={{ minHeight: '150px', minWidth: '380px' }}>
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
              onClick={status === 'pending' ? cancelRequest : submitRequest}
              disabled={status === 'complete'}
              className="w-32 cursor-pointer py-2 px-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(247,151,54,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(() => {
                switch(status) {
                  case 'pending':
                    return 'Cancel';
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
            <div className="bg-red-300/50 border-1 border-black text-black font-mono text-sm mt-2 p-2 rounded">
              {error}
            </div>
          )}

          {/* Combined Fields and Logging Display */}
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
                {result && (
                  <button
                    onClick={() => setActiveTab('result')}
                    className={`cursor-pointer px-4 py-2 text-sm font-semibold transition-colors relative ${
                      activeTab === 'result'
                        ? 'text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-black'
                        : 'text-gray-800 hover:text-black'
                    }`}
                  >
                    Result
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('logging')}
                  className={`cursor-pointer px-4 py-2 text-sm font-semibold transition-colors relative ${
                    activeTab === 'logging'
                      ? 'text-black after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-black'
                      : 'text-gray-800 hover:text-black'
                  }`}
                >
                  Logging
                </button>
              </div>

              {/* Content */}
              <div className={`relative mt-4 p-4 border-1 border-black rounded-md ${activeTab === 'fields' ? 'bg-transparent backdrop-blur-sm' : 'bg-gray-900/50 backdrop-blur-sm'}`}>
                {activeTab === 'fields' && requiredFields.length > 0 && (
                  <div className="space-y-3">
                    {requiredFields.map((field) => (
                      <div key={field.field_name}>
                        <label className="block text-black text-md mb-1">{field.field_name}</label>
                        <input
                          type="text"
                          value={fieldValues[field.field_name] || ''}
                          onChange={handleFieldChange(field.field_name)}
                          className="w-full px-4 py-2 text-black rounded-md border-1 border-black focus:ring-2 focus:ring-orange-500 focus-visible:ring-2 focus-visible:outline-none focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'result' && result && (
                  <div className="space-y-3">
                    <div className="text-white text-md">
                      <div className="space-y-2 grid grid-cols-[100px_1fr] gap-y-2">
                        <span>Status</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${result.success ? "bg-green-600" : "bg-red-600"}`}></div>
                          <span>{result.success ? "Success" : "Failed"}</span>
                        </div>
                        <span>Scheduled Time</span>
                        <span>{result.scheduled_time}</span>
                        <span>Scheduled Email</span>
                        <span>{result.scheduled_email}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'logging' && (
                  <div 
                    ref={stdoutRef}
                    className="min-h-[200px] h-[200px] overflow-y-auto overflow-x-auto will-change-transform transform-translate-z-0 scroll-behavior-smooth"
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
