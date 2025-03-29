import { useState, useEffect } from 'react'

function App() {
  const [website, setWebsite] = useState('https://revyl.ai')
  const [requestId, setRequestId] = useState(null)
  const [requestStatus, setRequestStatus] = useState(null)
  const [error, setError] = useState(null)
  const [requiredFields, setRequiredFields] = useState([])
  const [profileId, setProfileId] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [isSubmittingFields, setIsSubmittingFields] = useState(false)
  const [showProfiles, setShowProfiles] = useState(false)
  const [profiles, setProfiles] = useState([])

  // Function to fetch profiles
  const fetchProfiles = async () => {
    try {
      const response = await fetch('http://localhost:3000/profiles?user_id=test-user')
      if (!response.ok) {
        throw new Error('Failed to fetch profiles')
      }
      const data = await response.json()
      setProfiles(data)
    } catch (err) {
      setError(err.message)
    }
  }

  // Fetch profiles when sidebar is opened
  useEffect(() => {
      fetchProfiles()
  }, [])

  // Function to submit a new request
  const submitRequest = async () => {
    try {
      const response = await fetch('http://localhost:3000/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          website_url: website,
          user_id: 'test-user', // For demo purposes, using a fixed user ID
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit request')
      }

      const data = await response.json()
      setRequestId(data.request_id)
      setProfileId(data.profile_id)
      setError(null)
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

  // Function to submit required fields
  const submitRequiredFields = async () => {
    if (!profileId || requiredFields.length === 0) return

    setIsSubmittingFields(true)
    try {
      const response = await fetch(`http://localhost:3000/profile/${profileId}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'test-user',
          fields: Object.entries(fieldValues).map(([key, value]) => ({
            key,
            value
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit fields')
      }

      // Reset the form and resubmit the request
      setRequiredFields([])
      setFieldValues({})
      setIsSubmittingFields(false)
      setRequestId(null)
      await submitRequest()
    } catch (err) {
      setError(err.message)
      setIsSubmittingFields(false)
    }
  }

  // Function to check request status
  const checkRequestStatus = async () => {
    if (!requestId) return

    try {
      const response = await fetch(`http://localhost:3000/request/${requestId}?user_id=test-user`)
      if (!response.ok) {
        throw new Error('Failed to check request status')
      }

      const data = await response.json()
      setRequestStatus(data.status)

      // If request is blocked, parse the error message to get required fields
      if (data.status === 'blocked' && data.error) {
        const fieldsMatch = data.error.match(/Missing required profile fields: (.*)/)
        if (fieldsMatch) {
          const fields = fieldsMatch[1].split(', ')
          setRequiredFields(fields)
          // Initialize field values
          const initialValues = {}
          fields.forEach(field => {
            initialValues[field] = ''
          })
          setFieldValues(initialValues)
        }
      }
      if (data.status === 'completed') {
        setRequiredFields([])
      }
      if (data.status === 'error') {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // Poll for request status every 3 seconds
  useEffect(() => {
    if (!requestId) return

    // Stop polling if we've reached a terminal state
    if (['blocked', 'completed', 'error', 'failed'].includes(requestStatus)) {
      return
    }

    const pollInterval = setInterval(checkRequestStatus, 3000)
    return () => clearInterval(pollInterval)
  }, [requestId, requestStatus])

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
              disabled={requestId && !['blocked', 'completed', 'error', 'failed'].includes(requestStatus)}
              className="w-32 cursor-pointer py-2 px-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(247,151,54,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestId ? 'Processing...' : 'book a demo'}
            </button>
          </div>
          {profiles.length > 0 && <div className="flex flex-row justify-center">
            <button
              onClick={() => setShowProfiles(!showProfiles)}
              className="p-2 text-black hover:bg-gray-200/30 cursor-pointer rounded-full transition-colors"
            >
              <img src="/chevron-down.svg" alt="Toggle profiles" className={`h-6 w-6 transform transition-transform ${showProfiles ? 'rotate-180' : ''}`} />
            </button>
          </div>}

          {/* Status and Error Display */}
          {error && (
            <div className="text-red-500 text-sm mt-2">
              Error: {error}
            </div>
          )}

          {requestStatus && (
            <div className="text-white text-sm mt-2">
              Status: {requestStatus}
            </div>
          )}

          {/* Required Fields Form */}
          {requiredFields.length > 0 && (
            <div className="mt-4 p-4 bg-gray-700 rounded-md">
              <h2 className="text-white font-semibold mb-2">Required Fields:</h2>
              <div className="space-y-3">
                {requiredFields.map((field) => (
                  <div key={field}>
                    <label className="block text-white text-sm mb-1">{field}</label>
                    <input
                      type="text"
                      value={fieldValues[field] || ''}
                      onChange={handleFieldChange(field)}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-md border-2 border-transparent focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                ))}
                <button
                  onClick={submitRequiredFields}
                  disabled={isSubmittingFields || Object.values(fieldValues).some(value => !value)}
                  className="w-full mt-3 py-2 px-4 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingFields ? 'Submitting...' : 'Submit Fields'}
                </button>
              </div>
            </div>
          )}

          {/* Profile Management Section */}
          <div className={`transition-all duration-300 ${showProfiles ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
            <div className="border-1 border-black rounded-md p-2.5">
              <div className="flex flex-col">
                {/* Profile List */}
                <div className="space-y-2 mb-1">
                  <div className="text-black font-semibold">Profile</div>
                </div>

                {/* Selected Profile Fields */}
                  <div className="border-gray-600 rounded-md">
                    <div className="space-y-2">
                      {profiles.length > 0 && profiles[0].fields.map((field) => (
                        <div key={field.field_key} className="grid grid-cols-3 gap-2">
                          <div className="text-black border-1 border-black rounded-md p-1">{field.field_key}</div>
                          <input
                            type="text"
                            value={field.field_value}
                            className="col-span-2 text-black border-1 border-black focus:border-black focus:ring-2 focus:ring-orange-500 focus:outline-none rounded-md p-1"
                            onChange={(e) => {
                              // Handle input change
                              field.field_value = e.target.value;
                            }}
                          />
                        </div>
                      ))}
                      <button className="text-black border-1 border-black rounded-md p-1 cursor-pointer">
                        Add Field
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default App
