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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full p-4 bg-gray-800 rounded-md shadow-2xl">
        <h1 className="text-2xl font-semibold text-white mb-6 text-left">test the demo booking flow for your website.</h1>
        <div className="space-y-4">
          <div className="flex flex-row gap-2">
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
              onClick={submitRequest}
              disabled={requestId && !['blocked', 'completed', 'error', 'failed'].includes(requestStatus)}
              className="w-32 cursor-pointer py-2 px-2 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestId ? 'Processing...' : 'book a demo'}
            </button>
          </div>

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
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-md border-2 border-transparent focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                ))}
                <button
                  onClick={submitRequiredFields}
                  disabled={isSubmittingFields || Object.values(fieldValues).some(value => !value)}
                  className="w-full mt-3 py-2 px-4 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-semibold rounded-md shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingFields ? 'Submitting...' : 'Submit Fields'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
