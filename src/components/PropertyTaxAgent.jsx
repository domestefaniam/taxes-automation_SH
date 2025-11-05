import React, { useState, useEffect } from 'react'
import { Send, Home, DollarSign, CheckCircle, AlertCircle } from 'lucide-react'
import { 
  propertiesService, 
  countiesService, 
  parcelsService, 
  parcelTaxesService, 
  paymentsService, 
  taxesInformationService,
  kpisService 
} from '../services/supabaseService.js'
import { apiService } from '../services/apiService.js'

// Helper to append the standard footer to every assistant response
function appendFooter(text) {
  return `${text}\n\nType "back" to return to the main menu.`
}

// Centralized main menu content (English only)
function getMainMenu() {
  return 'Hello! I\'m your assistant for property management. I can help you with:\n\n1️⃣ Add a new property\n2️⃣ Add a new bill\n3️⃣ Add a new payment\n4️⃣ Change a property status: Open - Closed\n5️⃣ MasterList of properties\n6️⃣ Excel Report\n7️⃣ KPIs\n\nWhat do you need?'
}

export default function PropertyTaxAgent() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: appendFooter(getMainMenu()) }
  ])
  const [input, setInput] = useState('')
  const [properties, setProperties] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [counties, setCounties] = useState([])
  const [parcels, setParcels] = useState([])
  const [parcelTaxes, setParcelTaxes] = useState([])
  const [payments, setPayments] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Cargar datos iniciales de Supabase
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        const [propertiesResp, countiesData] = await Promise.all([
          apiService.getPropertiesWithTotals(selectedYear),
          countiesService.getAll()
        ])
        setProperties(propertiesResp.properties || [])
        setCounties(countiesData)
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading initial data:', error)
        setIsLoading(false)
        const message = error?.message || (typeof error === 'string' ? error : 'Unknown error')
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: appendFooter(`❌ Error loading data: ${message}`)
        }])
      }
    }
    
    loadInitialData()
  }, [selectedYear])

  const handleYearChange = async (e) => {
    const yearValue = parseInt(e.target.value)
    if (!isNaN(yearValue)) {
      setSelectedYear(yearValue)
    }
  }
  
  // Estados para el flujo de Add New Property
  const [propertyFlow, setPropertyFlow] = useState({
    isActive: false,
    step: 0,
    data: {
      basicInfo: {},
      counties: [],
      parcels: [],
      taxInfo: {},
      countySubflow: {
        isActive: false,
        step: 0,
        data: {
          countyName: '',
          state: '',
          descriptor: '',
          countyCode: '',
          existingCounty: null
        }
      },
      parcelSubflow: {
        isActive: false,
        plan: [],
        current: null
      }
    }
  })
  
  // Estados para el flujo de Add New Bill
  const [billFlow, setBillFlow] = useState({
    isActive: false,
    step: 0,
    data: {
      searchMethod: '',
      propertyId: '',
      property: null,
      billsCount: 0,
      bills: []
    }
  })
  
  // Estados para el flujo de Add New Payment
  const [paymentFlow, setPaymentFlow] = useState({
    isActive: false,
    step: 0,
    data: {
      searchMethod: '',
      propertyId: '',
      property: null,
      paymentsCount: 0,
      payments: []
    }
  })
  
  // Estados para el flujo de Change Property Status
  const [statusFlow, setStatusFlow] = useState({
    isActive: false,
    step: 0,
    data: {
      searchMethod: '',
      propertyId: '',
      property: null,
      currentStatus: '',
      newStatus: ''
    }
  })
  
  // Estados para el flujo de Excel Report
  const [reportFlow, setReportFlow] = useState({
    isActive: false,
    step: 0,
    data: {
      selectedFilters: [],
      filterValues: {},
      reportData: []
    }
  })
  

  // Funciones auxiliares para el flujo de Add New Property
  const startPropertyFlow = () => {
    setPropertyFlow({
      isActive: true,
      step: 1,
      data: {
        basicInfo: {},
        counties: [],
        parcels: [],
        taxInfo: {},
        countySubflow: {
          isActive: false,
          step: 0,
          data: {
            countyName: '',
            state: '',
            descriptor: '',
            countyCode: '',
            existingCounty: null
          }
        },
        parcelSubflow: {
          isActive: false,
          plan: [],
          current: null
        }
      }
    })
    return '🏠 **Add a new property**\n\nTo add a new property, please give me the following basic information:\n\n1. Group Code (Ex: A02, A03, BCR, etc)\n2. CO:\n3. Brand:\n4. Store #:\n5. Address:\n6. State:\n7. ZIP:\n8. Vendor ID:\n9. Landlord:\n10. Status of the property:\n\nPlease provide all information separated by commas or line by line.'
  }

  const processPropertyBasicInfo = async (userInput) => {
    const fields = ['group_code', 'co', 'brand', 'store_number', 'address', 'state', 'zip', 'vendor_id', 'landlord', 'open_closed']
    const values = userInput.split(',').map(v => v.trim())
    
    if (values.length < 10) {
      return '❌ Please provide all 10 required fields:\n\n1. Group Code\n2. CO\n3. Brand\n4. Store #\n5. Address\n6. State\n7. ZIP\n8. Vendor ID\n9. Landlord\n10. Status\n\nSeparate each field with a comma.'
    }
    
    const basicInfo = {}
    fields.forEach((field, index) => {
      basicInfo[field] = values[index] || ''
    })
    
    try {
      // Crear la propiedad en Supabase
      const newProperty = await propertiesService.create(basicInfo)
      
      setPropertyFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, basicInfo: newProperty }
      }))
      
      // Actualizar la lista de propiedades
      setProperties(prev => [...prev, newProperty])
      
      const availableCounties = counties.filter(c => c.state === basicInfo.state)
      let response = '✅ Basic information saved!\n\n**Step 2: Choose Counties**\n\nNow, choose one or more counties for this property.\n\nAvailable counties in ' + basicInfo.state + ':\n'
      
      availableCounties.forEach((county, index) => {
        response += `${index + 1}. ${county.county_name}\n`
      })
      
      response += '\nOr type "Add New County" to create a new one.\n\nPlease select counties by number (e.g., "1,3") or type "Add New County"'
      
      return response
    } catch (error) {
      console.error('Error creating property:', error)
      return '❌ Error creating property. Please try again.'
    }
  }

  const processCountySelection = (userInput) => {
    if (userInput.toLowerCase().includes('add new county')) {
      setPropertyFlow(prev => ({ 
        ...prev, 
        step: 2.1,
        data: {
          ...prev.data,
          countySubflow: {
            isActive: true,
            step: 1,
            data: {
              countyName: '',
              state: prev.data.basicInfo.state || '',
              descriptor: '',
              countyCode: '',
              existingCounty: null
            }
          }
        }
      }))
      return '🏛️ **Add New County**\n\n**Step 1: County Name**\n\nPlease provide the County Name:'
    }
    
    const selectedNumbers = userInput.match(/\d+/g)
    if (!selectedNumbers) {
      return '❌ Please select counties by number (e.g., "1,3") or type "Add New County"'
    }
    
    const selectedCounties = selectedNumbers.map(num => {
      const index = parseInt(num) - 1
      return counties[index]
    }).filter(Boolean)
    
    if (selectedCounties.length === 0) {
      return '❌ Invalid selection. Please select valid county numbers.'
    }
    
    setPropertyFlow(prev => ({
      ...prev,
      step: 3,
      data: { ...prev.data, counties: selectedCounties }
    }))
    
    let response = '✅ Counties selected!\n\n**Step 3: Parcels Information**\n\nSelected counties:\n'
    selectedCounties.forEach(county => {
      response += `• ${county.county_name}\n`
    })
    
    response += '\nFor each county, please specify:\n• How many parcels does this county have?\n\nPlease provide the number of parcels for each county (e.g., "Harris County: 2, Dallas County: 1")'
    
    return response
  }

  const processNewCounty = (userInput) => {
    const values = userInput.split(',').map(v => v.trim())
    if (values.length < 4) {
      return '❌ Please provide all 4 required fields:\n\n1. County Name\n2. State\n3. Descriptor\n4. County\n\nSeparate each field with a comma.'
    }
    
    const newCounty = {
      id: counties.length + 1,
      county_name: values[0],
      state: values[1],
      descriptor: values[2],
      county: values[3]
    }
    
    setPropertyFlow(prev => ({
      ...prev,
      step: 3,
      data: { 
        ...prev.data, 
        counties: [...prev.data.counties, newCounty]
      }
    }))
    
    return `✅ New county "${newCounty.county_name}" added!\n\n**Step 3: Parcels Information**\n\nFor each county, please specify:\n• How many parcels does this county have?\n\nPlease provide the number of parcels for each county (e.g., "Harris County: 2, Dallas County: 1")`
  }

  const processParcelsInfo = (userInput) => {
    const entries = userInput.split(',').map(s => s.trim()).filter(Boolean)
    if (entries.length === 0) {
      return '❌ Please provide parcel counts like: "Harris County: 2, Dallas County: 1"'
    }

    const plan = []
    for (const entry of entries) {
      const m = entry.match(/^(.+?):\s*(\d+)$/)
      if (!m) {
        return '❌ Invalid format. Use: "County Name: N". Example: "Harris County: 2"'
      }
      const name = m[1].trim()
      const count = parseInt(m[2], 10)
      const county = propertyFlow.data.counties.find(c => c.county_name.toLowerCase() === name.toLowerCase())
      if (!county) {
        return `❌ County "${name}" is not in the selected list.`
      }
      if (count <= 0) {
        return `❌ Count for "${name}" must be > 0.`
      }
      plan.push({ county_id: county.id, county_name: county.county_name, remaining: count })
    }

    const first = plan[0]
    setPropertyFlow(prev => ({
      ...prev,
      data: {
        ...prev.data,
        parcelSubflow: {
          isActive: true,
          plan,
          current: { county_id: first.county_id, county_name: first.county_name, index: 1 }
        }
      }
    }))

    return `📦 **Parcels - ${first.county_name} (1/${plan[0].remaining})**\n\nPlease provide:\n• parcel_id (unique)\n• payable_to\n• account\n• parcel (label)\n\nSeparate with commas.`
  }

  const processParcelDetails = async (userInput) => {
    const fields = userInput.split(',').map(v => v.trim())
    if (fields.length < 4) {
      return '❌ Please provide 4 fields: parcel_id, payable_to, account, parcel'
    }
    const [parcel_id, payable_to, account, parcelLabel] = fields

    if (!parcel_id) {
      return '❌ "parcel_id" is required and must be unique.'
    }

    const { basicInfo, parcelSubflow } = propertyFlow.data
    const current = parcelSubflow.current
    const parcelData = {
      parcel_id,
      property: basicInfo.id,
      county_id: current.county_id,
      payable_to,
      account,
      parcel: parcelLabel
    }

    try {
      const created = await parcelsService.create(parcelData)

      const newPlan = parcelSubflow.plan.map(p =>
        p.county_id === current.county_id ? { ...p, remaining: p.remaining - 1 } : p
      )

      let nextCurrent = null
      let nextCounty = newPlan.find(p => p.county_id === current.county_id && p.remaining > 0)
      if (nextCounty) {
        nextCurrent = { county_id: nextCounty.county_id, county_name: nextCounty.county_name, index: (parcelSubflow.current.index || 1) + 1 }
      } else {
        nextCounty = newPlan.find(p => p.remaining > 0)
        if (nextCounty) {
          nextCurrent = { county_id: nextCounty.county_id, county_name: nextCounty.county_name, index: 1 }
        }
      }

      if (nextCurrent) {
        setPropertyFlow(prev => ({
          ...prev,
          data: {
            ...prev.data,
            parcels: [...prev.data.parcels, created],
            parcelSubflow: { isActive: true, plan: newPlan, current: nextCurrent }
          }
        }))
        const planned = newPlan.find(p => p.county_id === nextCurrent.county_id)
        const totalForCounty = planned.remaining + (nextCurrent.index - 1)
        return `📦 **Parcels - ${nextCurrent.county_name} (${nextCurrent.index}/${totalForCounty})**\n\nPlease provide: parcel_id, payable_to, account, parcel`
      } else {
        setPropertyFlow(prev => ({
          ...prev,
          step: 4,
          data: {
            ...prev.data,
            parcels: [...prev.data.parcels, created],
            parcelSubflow: { isActive: false, plan: [], current: null }
          }
        }))
        return '✅ Parcels saved!\n\n**Step 4: Lease and Taxes Information**\n\n1. Tenancy Type (Leased, Owned or Subleased)\n2. Lease Type (Gross - Ground Lease)\n3. Lease Clauses:\n4. Responsible of payment (Landlord/Owner, Shared, Tenant or Subtenant):\n5. Responsibility (Pay, Record or Shared):\n6. Reimbursement (Yes, No)\n\nProvide all separated by commas.'
      }
    } catch (error) {
      return `❌ Error saving parcel: ${error.message || error}`
    }
  }

  const processTaxInfo = async (userInput) => {
    const values = userInput.split(',').map(v => v.trim())
    if (values.length < 6) {
      return '❌ Please provide all 6 required fields:\n\n1. Tenancy Type\n2. Lease Type\n3. Lease Clauses\n4. Responsible of payment\n5. Responsibility\n6. Reimbursement\n\nSeparate each field with a comma.'
    }
    
    try {
      const payload = {
        property_id: propertyFlow.data.basicInfo.id,
        tenancy_type: values[0],
        lease_type: values[1],
        lease_clauses: values[2],
        responsible_of_payment: values[3],
        responsibility: values[4],
        reimbursement: /^(yes|true|1|si|sí)$/i.test(values[5])
      }
      await taxesInformationService.create(payload)

      setPropertyFlow({ isActive: false, step: 0, data: {} })

      return `🎉 **Your property has been saved successfully!**\n\nProperty Details:\n• Address: ${propertyFlow.data.basicInfo.address}\n• Group Code: ${propertyFlow.data.basicInfo.group_code}\n• Brand: ${propertyFlow.data.basicInfo.brand}\n• Store #: ${propertyFlow.data.basicInfo.store_number}\n• Counties: ${propertyFlow.data.counties.map(c => c.county_name).join(', ')}\n• Status: ${propertyFlow.data.basicInfo.open_closed}\n\nProperty ID: ${propertyFlow.data.basicInfo.id}\n\nWhat would you like to do next?`
    } catch (error) {
      return `❌ Error saving taxes information: ${error.message || error}`
    }
  }

  // Funciones auxiliares para el subflujo de Add New County
  const processCountyName = (userInput) => {
    const countyName = userInput.trim()
    if (!countyName) {
      return '❌ Please provide a valid County Name.'
    }
    
    setPropertyFlow(prev => ({
      ...prev,
      data: {
        ...prev.data,
        countySubflow: {
          ...prev.data.countySubflow,
          step: 2,
          data: {
            ...prev.data.countySubflow.data,
            countyName: countyName
          }
        }
      }
    }))
    
    return `✅ County Name: ${countyName}\n\n**Step 2: State**\n\nPlease provide the State (current property state: ${propertyFlow.data.basicInfo.state}):`
  }

  const processCountyState = (userInput) => {
    const state = userInput.trim().toUpperCase()
    if (!state) {
      return '❌ Please provide a valid State.'
    }
    
    setPropertyFlow(prev => ({
      ...prev,
      data: {
        ...prev.data,
        countySubflow: {
          ...prev.data.countySubflow,
          step: 3,
          data: {
            ...prev.data.countySubflow.data,
            state: state
          }
        }
      }
    }))
    
    return `✅ State: ${state}\n\n**Step 3: Descriptor**\n\nPlease provide the Descriptor (City, CAD, Tax Office, Treasurer):`
  }

  const processCountyDescriptor = (userInput) => {
    const descriptor = userInput.trim()
    if (!descriptor) {
      return '❌ Please provide a valid Descriptor (City, CAD, Tax Office, Treasurer).'
    }
    
    setPropertyFlow(prev => ({
      ...prev,
      data: {
        ...prev.data,
        countySubflow: {
          ...prev.data.countySubflow,
          step: 4,
          data: {
            ...prev.data.countySubflow.data,
            descriptor: descriptor
          }
        }
      }
    }))
    
    return `✅ Descriptor: ${descriptor}\n\n**Step 4: County Code**\n\nPlease provide the County code or short label:`
  }

  const processCountyCode = async (userInput) => {
    const countyCode = userInput.trim()
    if (!countyCode) {
      return '❌ Please provide a valid County code or short label.'
    }
    
    const countyData = propertyFlow.data.countySubflow.data
    
    // Verificar si el county ya existe en este estado
    const existingCounty = counties.find(c => 
      c.county_name.toLowerCase() === countyData.countyName.toLowerCase() && 
      c.state === countyData.state
    )
    
    if (existingCounty) {
      setPropertyFlow(prev => ({
        ...prev,
        data: {
          ...prev.data,
          countySubflow: {
            ...prev.data.countySubflow,
            step: 5,
            data: {
              ...prev.data.countySubflow.data,
              countyCode: countyCode,
              existingCounty: existingCounty
            }
          }
        }
      }))
      
      return `⚠️ **County Already Exists**\n\nThis county already exists in ${countyData.state}:\n• County: ${existingCounty.county_name}\n• State: ${existingCounty.state}\n• Descriptor: ${existingCounty.descriptor}\n\nDo you want to use this existing county?\n\nType "Yes" to use existing county or "No" to create a new one with a different name.`
    } else {
      const createdCounty = await countiesService.create({
        county_name: countyData.countyName,
        state: countyData.state,
        descriptor: countyData.descriptor,
        county: countyCode
      })
      setCounties(prev => [...prev, createdCounty])
      setPropertyFlow(prev => ({
        ...prev,
        step: 3,
        data: {
          ...prev.data,
          counties: [...prev.data.counties, createdCounty],
          countySubflow: {
            isActive: false,
            step: 0,
            data: {
              countyName: '',
              state: '',
              descriptor: '',
              countyCode: '',
              existingCounty: null
            }
          }
        }
      }))
      
      return `✅ New county "${createdCounty.county_name}" created successfully!\n\n**Step 3: Parcels Information**\n\nFor each county, please specify:\n• How many parcels does this county have?\n\nPlease provide the number of parcels for each county (e.g., "Harris County: 2, Dallas County: 1")`
    }
  }

  const processCountyExistsConfirmation = (userInput) => {
    if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('sí')) {
      // Usar county existente
      const existingCounty = propertyFlow.data.countySubflow.data.existingCounty
      
      setPropertyFlow(prev => ({
        ...prev,
        step: 3,
        data: {
          ...prev.data,
          counties: [...prev.data.counties, existingCounty],
          countySubflow: {
            isActive: false,
            step: 0,
            data: {
              countyName: '',
              state: '',
              descriptor: '',
              countyCode: '',
              existingCounty: null
            }
          }
        }
      }))
      
      return `✅ Using existing county "${existingCounty.county_name}"!\n\n**Step 3: Parcels Information**\n\nFor each county, please specify:\n• How many parcels does this county have?\n\nPlease provide the number of parcels for each county (e.g., "Harris County: 2, Dallas County: 1")`
    } else if (userInput.toLowerCase().includes('no')) {
      setPropertyFlow(prev => ({
        ...prev,
        data: {
          ...prev.data,
          countySubflow: {
            ...prev.data.countySubflow,
            step: 6,
            data: {
              ...prev.data.countySubflow.data
            }
          }
        }
      }))
      
      return `🔄 **Enter New Name**\n\nPlease enter a new county name to create a unique record:`
    } else {
      return '❌ Please answer "Yes" to use existing county or "No" to create a new one.'
    }
  }

  const processNewCountyName = async (userInput) => {
    const newCountyName = userInput.trim()
    if (!newCountyName) {
      return '❌ Please provide a valid new county name.'
    }
    
    // Verificar si el nuevo nombre también existe
    const existingCounty = counties.find(c => 
      c.county_name.toLowerCase() === newCountyName.toLowerCase() && 
      c.state === propertyFlow.data.countySubflow.data.state
    )
    
    if (existingCounty) {
      return `❌ The county "${newCountyName}" also exists in ${propertyFlow.data.countySubflow.data.state}. Please enter a different name.`
    }
    
    const createdCounty = await countiesService.create({
      county_name: newCountyName,
      state: propertyFlow.data.countySubflow.data.state,
      descriptor: propertyFlow.data.countySubflow.data.descriptor,
      county: propertyFlow.data.countySubflow.data.countyCode
    })
    setCounties(prev => [...prev, createdCounty])
    setPropertyFlow(prev => ({
      ...prev,
      step: 3,
      data: {
        ...prev.data,
        counties: [...prev.data.counties, createdCounty],
        countySubflow: {
          isActive: false,
          step: 0,
          data: {
            countyName: '',
            state: '',
            descriptor: '',
            countyCode: '',
            existingCounty: null
          }
        }
      }
    }))
    
    return `✅ New county "${createdCounty.county_name}" created successfully!\n\n**Step 3: Parcels Information**\n\nFor each county, please specify:\n• How many parcels does this county have?\n\nPlease provide the number of parcels for each county (e.g., "Harris County: 2, Dallas County: 1")`
  }

  // Funciones auxiliares para el flujo de Add New Bill
  const startBillFlow = () => {
    setBillFlow({
      isActive: true,
      step: 1,
      data: {
        searchMethod: '',
        propertyId: '',
        property: null,
        billsCount: 0,
        bills: []
      }
    })
    return '📄 **Add a new bill**\n\nSelect the property by number (1) or address (2)'
  }

  const processBillSearchMethod = (userInput) => {
    const input = userInput.trim()
    if (input === '1' || input.toLowerCase().includes('number')) {
      setBillFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'number' }
      }))
      return '🔢 Give me the number of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ID: ${p.id} - ${p.address}`).join('\n') +
             '\n\nPlease enter the property number.'
    } else if (input === '2' || input.toLowerCase().includes('address')) {
      setBillFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'address' }
      }))
      return '🏠 Give me the address of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ${p.address}`).join('\n') +
             '\n\nPlease enter the property address (partial match is OK).'
    } else {
      return '❌ Please select 1 for number or 2 for address.'
    }
  }

  const processBillPropertySearch = (userInput) => {
    let foundProperty = null
    
    if (billFlow.data.searchMethod === 'number') {
      const propertyNumber = parseInt(userInput.trim())
      foundProperty = properties.find(p => p.id === propertyNumber)
    } else if (billFlow.data.searchMethod === 'address') {
      const searchAddress = userInput.toLowerCase()
      foundProperty = properties.find(p => p.address.toLowerCase().includes(searchAddress))
    }
    
    if (!foundProperty) {
      return '❌ Property not found. Please try again with a valid ' + 
             (billFlow.data.searchMethod === 'number' ? 'property number' : 'address') + '.'
    }
    
    setBillFlow(prev => ({
      ...prev,
      step: 3,
      data: { ...prev.data, property: foundProperty }
    }))
    
    return `✅ Property found!\n\nAre you referring to Property ID ${foundProperty.id} with Address "${foundProperty.address}"?\n\nType "Yes" to continue or "No" to search again.`
  }

  const processBillPropertyConfirmation = (userInput) => {
    if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('sí')) {
      setBillFlow(prev => ({
        ...prev,
        step: 4,
        data: { ...prev.data }
      }))
      return '✅ Property confirmed!\n\nHow many bills do you want to register?'
    } else if (userInput.toLowerCase().includes('no')) {
      setBillFlow(prev => ({
        ...prev,
        step: 1,
        data: { ...prev.data, property: null }
      }))
      return '🔄 Let\'s search again.\n\nSelect the property by number (1) or address (2)'
    } else {
      return '❌ Please answer "Yes" or "No".'
    }
  }

  const processBillCount = async (userInput) => {
    const count = parseInt(userInput.trim())
    if (isNaN(count) || count < 1) {
      return '❌ Please enter a valid number of bills (minimum 1).'
    }

    setBillFlow(prev => ({
      ...prev,
      step: 5,
      data: { 
        ...prev.data, 
        billsCount: count,
        bills: []
      }
    }))

    const propertyId = billFlow.data.property.id
    let propertyParcels = parcels.filter(p => p.property === propertyId)
    if (propertyParcels.length === 0) {
      try {
        const fetched = await parcelsService.getByProperty(propertyId)
        setParcels(prev => {
          const byId = new Map(prev.map(p => [p.id, p]))
          fetched.forEach(p => byId.set(p.id, p))
          return Array.from(byId.values())
        })
        propertyParcels = fetched
      } catch (e) {
        return `❌ Error loading parcels for the property: ${e.message || e}`
      }
    }

    const parcelsWithCounties = propertyParcels.map(p => {
      const countyName = p.counties?.county_name || (counties.find(c => c.id === p.county_id)?.county_name) || 'Unknown County'
      return { ...p, county_name: countyName }
    })

    let response = `✅ ${count} bill(s) to register!\n\n**Bill 1 of ${count}**\n\nSelect the County and Parcel:\n\n`
    parcelsWithCounties.forEach((parcel, index) => {
      response += `${index + 1}. ${parcel.county_name} - ${parcel.parcel} (${parcel.payable_to})\n`
    })
    response += '\nPlease select by number (e.g., "1")'
    return response
  }

  const processBillParcelSelection = (userInput) => {
    const input = userInput.trim().toLowerCase()
    if (input === 'list' || input === 'back') {
      const propertyParcels = parcels.filter(p => p.property === billFlow.data.property.id)
      const parcelsWithCounties = propertyParcels.map(p => {
        const county = counties.find(c => c.id === p.county_id)
        return { ...p, county_name: county ? county.county_name : 'Unknown County' }
      })
      let response = '🔁 Parcel list refreshed. Select the County and Parcel by number:\n\n'
      parcelsWithCounties.forEach((parcel, index) => {
        response += `${index + 1}. ${parcel.county_name} - ${parcel.parcel} (${parcel.payable_to})\n`
      })
      response += '\nPlease select by number (e.g., "1")'
      return response
    }

    const parcelNumber = parseInt(input)
    const propertyParcels = parcels.filter(p => p.property === billFlow.data.property.id)
    const parcelsWithCounties = propertyParcels.map(p => {
      const county = counties.find(c => c.id === p.county_id)
      return { ...p, county_name: county ? county.county_name : 'Unknown County' }
    })
    
    if (isNaN(parcelNumber) || parcelNumber < 1 || parcelNumber > parcelsWithCounties.length) {
      return '❌ Please select a valid parcel number.'
    }
    
    const selectedParcel = parcelsWithCounties[parcelNumber - 1]
    
    setBillFlow(prev => ({
      ...prev,
      step: 6,
      data: { 
        ...prev.data, 
        currentParcel: selectedParcel
      }
    }))
    
    return `✅ Parcel selected: ${selectedParcel.county_name} - ${selectedParcel.parcel}\n\nEnter Year, Amount Due, Due Date\n\nPlease provide:\n• Year (e.g., 2024)\n• Amount Due (e.g., 3500)\n• Due Date (e.g., 2024-12-31)\n\nSeparate each field with a comma.`
  }

  const processBillDetails = async (userInput) => {
    const values = userInput.split(',').map(v => v.trim())
    if (values.length < 3) {
      return '❌ Please provide all 3 required fields:\n\n• Year\n• Amount Due\n• Due Date\n\nSeparate each field with a comma.'
    }
    
    const year = values[0]
    const amountDue = parseFloat(values[1])
    const dueDate = values[2]
    
    if (isNaN(amountDue) || amountDue <= 0) {
      return '❌ Please enter a valid amount due (positive number).'
    }
    
    // Crear bill via API backend
    let createdBill
    try {
      const r = await apiService.createBill({
        parcel_id: billFlow.data.currentParcel.id,
        year,
        amount_due: amountDue,
        due_date: dueDate
      })
      createdBill = r.bill
    } catch (e) {
      return `❌ Error creating bill: ${e.message}`
    }

    const updatedBills = [...billFlow.data.bills, createdBill]
    const currentBillNumber = updatedBills.length
    
    if (currentBillNumber < billFlow.data.billsCount) {
      setBillFlow(prev => ({
        ...prev,
        step: 5,
        data: { 
          ...prev.data, 
          bills: updatedBills
        }
      }))
      
      // Obtener parcels para la propiedad
      const propertyParcels = parcels.filter(p => p.property === billFlow.data.property.id)
      const parcelsWithCounties = propertyParcels.map(p => {
        const county = counties.find(c => c.id === p.county_id)
        return { ...p, county_name: county ? county.county_name : 'Unknown County' }
      })
      
      let response = `✅ Bill ${currentBillNumber} added (ID: ${createdBill.id}).\n\n**Bill ${currentBillNumber + 1} of ${billFlow.data.billsCount}**\n\nSelect the County and Parcel:\n\n`
      parcelsWithCounties.forEach((parcel, index) => {
        response += `${index + 1}. ${parcel.county_name} - ${parcel.parcel} (${parcel.payable_to})\n`
      })
      
      response += '\nPlease select by number (e.g., "1")'
      
      return response
    } else {
      // Todos los bills completados
      setBillFlow({ isActive: false, step: 0, data: {} })
      
      let response = `🎉 **Bill(s) added successfully!**\n\nSummary:\n`
      updatedBills.forEach((bill, index) => {
        const parcel = parcels.find(p => p.id === bill.parcel_id)
        const county = parcel ? counties.find(c => c.id === parcel.county_id) : null
        response += `\n**Bill ${index + 1}:**\n• ID: ${bill.id}\n• County: ${county ? county.county_name : 'Unknown'}\n• Parcel: ${parcel ? parcel.parcel : 'Unknown'}\n• Year: ${bill.year}\n• Amount Due: $${Number(bill.amount_due || 0).toLocaleString()}\n• Due Date: ${bill.due_date || ''}\n• Status: ${bill.status}`
      })
      
      response += '\n\nWhat would you like to do next?'
      
      return response
    }
  }

  // Funciones auxiliares para el flujo de Add New Payment
  const startPaymentFlow = () => {
    setPaymentFlow({
      isActive: true,
      step: 1,
      data: {
        searchMethod: '',
        propertyId: '',
        property: null,
        paymentsCount: 0,
        payments: []
      }
    })
    return '💳 **Add a new payment**\n\nSelect the property by number (1) or address (2)'
  }

  const processPaymentSearchMethod = (userInput) => {
    const input = userInput.trim()
    if (input === '1' || input.toLowerCase().includes('number')) {
      setPaymentFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'number' }
      }))
      return '🔢 Give me the number of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ID: ${p.id} - ${p.address}`).join('\n') +
             '\n\nPlease enter the property number.'
    } else if (input === '2' || input.toLowerCase().includes('address')) {
      setPaymentFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'address' }
      }))
      return '🏠 Give me the address of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ${p.address}`).join('\n') +
             '\n\nPlease enter the property address (partial match is OK).'
    } else {
      return '❌ Please select 1 for number or 2 for address.'
    }
  }

  const processPaymentPropertySearch = (userInput) => {
    let foundProperty = null
    
    if (paymentFlow.data.searchMethod === 'number') {
      const propertyNumber = parseInt(userInput.trim())
      foundProperty = properties.find(p => p.id === propertyNumber)
    } else if (paymentFlow.data.searchMethod === 'address') {
      const searchAddress = userInput.toLowerCase()
      foundProperty = properties.find(p => p.address.toLowerCase().includes(searchAddress))
    }
    
    if (!foundProperty) {
      return '❌ Property not found. Please try again with a valid ' + 
             (paymentFlow.data.searchMethod === 'number' ? 'property number' : 'address') + '.'
    }
    
    setPaymentFlow(prev => ({
      ...prev,
      step: 3,
      data: { ...prev.data, property: foundProperty }
    }))
    
    return `✅ Property found!\n\nAre you referring to Property ID ${foundProperty.id} with Address "${foundProperty.address}"?\n\nType "Yes" to continue or "No" to search again.`
  }

  const processPaymentPropertyConfirmation = (userInput) => {
    if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('sí')) {
      setPaymentFlow(prev => ({
        ...prev,
        step: 4,
        data: { ...prev.data }
      }))
      return '✅ Property confirmed!\n\nHow many payments do you want to register?'
    } else if (userInput.toLowerCase().includes('no')) {
      setPaymentFlow(prev => ({
        ...prev,
        step: 1,
        data: { ...prev.data, property: null }
      }))
      return '🔄 Let\'s search again.\n\nSelect the property by number (1) or address (2)'
    } else {
      return '❌ Please answer "Yes" or "No".'
    }
  }

  const processPaymentCount = async (userInput) => {
    const count = parseInt(userInput.trim())
    if (isNaN(count) || count < 1) {
      return '❌ Please enter a valid number of payments (minimum 1).'
    }

    // Guardar conteo y avanzar de paso
    setPaymentFlow(prev => ({
      ...prev,
      step: 5,
      data: {
        ...prev.data,
        paymentsCount: count,
        payments: []
      }
    }))

    // Traer bills pendientes desde el backend y filtrar por la propiedad actual
    const propertyId = paymentFlow.data.property.id
    let pendingForProperty = []
    try {
      const r = await apiService.getPendingBills()
      const all = r.parcel_taxes || []
      pendingForProperty = all.filter(b => b?.property?.id === propertyId)
    } catch (e) {
      return `❌ Error loading pending bills: ${e.message || e}`
    }

    if (pendingForProperty.length === 0) {
      setPaymentFlow({ isActive: false, step: 0, data: {} })
      return '❌ No pending bills found for this property. All bills are already paid.'
    }

    // Normalizar datos para UI
    const billsWithDetails = pendingForProperty.map(b => {
      const county = counties.find(c => c.id === (b.parcel ? b.parcel.county_id : undefined))
      return {
        parcel_taxes_id: b.id,
        year: b.year,
        amount_due: b.amount_due,
        due_date: b.due_date,
        status: b.status,
        county_name: county ? county.county_name : 'Unknown County',
        parcel: b.parcel ? b.parcel.parcel : 'Unknown Parcel'
      }
    })

    // Guardar para uso en siguientes pasos
    setPaymentFlow(prev => ({
      ...prev,
      data: {
        ...prev.data,
        pendingBills: billsWithDetails
      }
    }))

    // Renderizar listado
    let response = `✅ ${count} payment(s) to register!\n\n**Payment 1 of ${count}**\n\nSelect County, Parcel, Year, and Bill:\n\n`
    billsWithDetails.forEach((bill, index) => {
      response += `${index + 1}. ${bill.county_name} - ${bill.parcel} - Year ${bill.year} - $${Number(bill.amount_due || 0).toLocaleString()} (Due: ${bill.due_date || ''})\n`
    })
    response += '\nPlease select by number (e.g., "1")'
    return response
  }

  const processPaymentBillSelection = (userInput) => {
    const billNumber = parseInt(userInput.trim())

    const billsWithDetails = paymentFlow.data.pendingBills || []
    if (isNaN(billNumber) || billNumber < 1 || billNumber > billsWithDetails.length) {
      return '❌ Please select a valid bill number.'
    }

    const selectedBill = billsWithDetails[billNumber - 1]

    setPaymentFlow(prev => ({
      ...prev,
      step: 6,
      data: {
        ...prev.data,
        currentBill: selectedBill
      }
    }))

    return `✅ Bill selected: ${selectedBill.county_name} - ${selectedBill.parcel} - Year ${selectedBill.year}\n\nPlease register your payment details:\n\n• Base Amount (e.g., 3500)\n• Late Fees (e.g., 0 or 50)\n• Transaction Fees (e.g., 0 or 25)\n• Total Paid (e.g., 3500)\n• Payment Date (e.g., 2024-11-15)\n• Confirmation Number (e.g., TXN123456)\n• Paid By (e.g., John Doe)\n\nSeparate each field with a comma.`
  }

  const processPaymentDetails = (userInput) => {
    const values = userInput.split(',').map(v => v.trim())
    if (values.length < 7) {
      return '❌ Please provide all 7 required fields:\n\n• Base Amount\n• Late Fees\n• Transaction Fees\n• Total Paid\n• Payment Date\n• Confirmation Number\n• Paid By\n\nSeparate each field with a comma.'
    }
    
    const baseAmount = parseFloat(values[0])
    const lateFees = parseFloat(values[1])
    const transactionFees = parseFloat(values[2])
    const totalPaid = parseFloat(values[3])
    const paymentDate = values[4]
    const confirmationNumber = values[5]
    const paidBy = values[6]
    
    if (isNaN(baseAmount) || isNaN(lateFees) || isNaN(transactionFees) || isNaN(totalPaid)) {
      return '❌ Please enter valid numeric values for amounts.'
    }
    
    if (baseAmount <= 0 || totalPaid <= 0) {
      return '❌ Base amount and total paid must be positive numbers.'
    }
    
    const newPayment = {
      parcel_taxes_id: paymentFlow.data.currentBill.parcel_taxes_id,
      amount_paid: totalPaid,
      payment_date: paymentDate,
      confirmation_number: confirmationNumber,
      paid_by: paidBy,
      late_fees: lateFees,
      transaction_fees: transactionFees,
      base_amount: baseAmount
    }
    
    const updatedPayments = [...paymentFlow.data.payments, newPayment]
    const currentPaymentNumber = updatedPayments.length
    
    // Simular actualización del status del bill a 'paid'
    const updatedParcelTaxes = parcelTaxes.map(pt => 
      pt.parcel_taxes_id === paymentFlow.data.currentBill.parcel_taxes_id 
        ? { ...pt, status: 'paid' }
        : pt
    )
    
    if (currentPaymentNumber < paymentFlow.data.paymentsCount) {
      setPaymentFlow(prev => ({
        ...prev,
        step: 5,
        data: { 
          ...prev.data, 
          payments: updatedPayments
        }
      }))
      
      // Obtener bills pendientes restantes
      const propertyParcels = parcels.filter(p => p.property === paymentFlow.data.property.id)
      const propertyParcelIds = propertyParcels.map(p => p.parcel_id)
      const pendingBills = updatedParcelTaxes.filter(pt => 
        propertyParcelIds.includes(pt.parcel_id) && pt.status === 'pending'
      )
      
      if (pendingBills.length === 0) {
        setPaymentFlow({ isActive: false, step: 0, data: {} })
        return `✅ Payment ${currentPaymentNumber} added!\n\n🎉 **All payments completed!**\n\nNo more pending bills for this property.\n\nWhat would you like to do next?`
      }
      
      const billsWithDetails = pendingBills.map(bill => {
        const parcel = parcels.find(p => p.parcel_id === bill.parcel_id)
        const county = counties.find(c => c.id === parcel.county_id)
        return {
          ...bill,
          county_name: county ? county.county_name : 'Unknown County',
          parcel: parcel ? parcel.parcel : 'Unknown Parcel'
        }
      })
      
      let response = `✅ Payment ${currentPaymentNumber} added!\n\n**Payment ${currentPaymentNumber + 1} of ${paymentFlow.data.paymentsCount}**\n\nSelect County, Parcel, Year, and Bill:\n\n`
      billsWithDetails.forEach((bill, index) => {
        response += `${index + 1}. ${bill.county_name} - ${bill.parcel} - Year ${bill.year} - $${bill.amount_due.toLocaleString()} (Due: ${bill.due_date})\n`
      })
      
      response += '\nPlease select by number (e.g., "1")'
      
      return response
    } else {
      // Todos los payments completados
      setPaymentFlow({ isActive: false, step: 0, data: {} })
      
      let response = `🎉 **Payment(s) saved successfully!**\n\nSummary:\n`
      updatedPayments.forEach((payment, index) => {
        const bill = paymentFlow.data.currentBill
        response += `\n**Payment ${index + 1}:**\n• County: ${bill.county_name}\n• Parcel: ${bill.parcel}\n• Year: ${bill.year}\n• Base Amount: $${payment.base_amount.toLocaleString()}\n• Late Fees: $${payment.late_fees.toLocaleString()}\n• Transaction Fees: $${payment.transaction_fees.toLocaleString()}\n• Total Paid: $${payment.amount_paid.toLocaleString()}\n• Payment Date: ${payment.payment_date}\n• Confirmation: ${payment.confirmation_number}\n• Paid By: ${payment.paid_by}`
      })
      
      response += '\n\nWhat would you like to do next?'
      
      return response
    }
  }

  // Funciones auxiliares para el flujo de Change Property Status
  const startStatusFlow = () => {
    setStatusFlow({
      isActive: true,
      step: 1,
      data: {
        searchMethod: '',
        propertyId: '',
        property: null,
        currentStatus: '',
        newStatus: ''
      }
    })
    return '🔄 **Change a property status: Open - Closed**\n\nSelect the property by number (1) or address (2)'
  }

  const processStatusSearchMethod = (userInput) => {
    const input = userInput.trim()
    if (input === '1' || input.toLowerCase().includes('number')) {
      setStatusFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'number' }
      }))
      return '🔢 Give me the number of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ID: ${p.id} - ${p.address}`).join('\n') +
             '\n\nPlease enter the property number.'
    } else if (input === '2' || input.toLowerCase().includes('address')) {
      setStatusFlow(prev => ({
        ...prev,
        step: 2,
        data: { ...prev.data, searchMethod: 'address' }
      }))
      return '🏠 Give me the address of the property.\n\nAvailable properties:\n' + 
             properties.map((p, index) => `${index + 1}. ${p.address}`).join('\n') +
             '\n\nPlease enter the property address (partial match is OK).'
    } else {
      return '❌ Please select 1 for number or 2 for address.'
    }
  }

  const processStatusPropertySearch = (userInput) => {
    let foundProperty = null
    
    if (statusFlow.data.searchMethod === 'number') {
      const propertyNumber = parseInt(userInput.trim())
      foundProperty = properties.find(p => p.id === propertyNumber)
    } else if (statusFlow.data.searchMethod === 'address') {
      const searchAddress = userInput.toLowerCase()
      foundProperty = properties.find(p => p.address.toLowerCase().includes(searchAddress))
    }
    
    if (!foundProperty) {
      return '❌ Property not found. Please try again with a valid ' + 
             (statusFlow.data.searchMethod === 'number' ? 'property number' : 'address') + '.'
    }
    
    setStatusFlow(prev => ({
      ...prev,
      step: 3,
      data: { ...prev.data, property: foundProperty }
    }))
    
    return `✅ Property found!\n\nAre you referring to Property ID ${foundProperty.id} with Address "${foundProperty.address}"?\n\nType "Yes" to continue or "No" to search again.`
  }

  const processStatusPropertyConfirmation = (userInput) => {
    if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('sí')) {
      setStatusFlow(prev => ({
        ...prev,
        step: 4,
        data: { ...prev.data }
      }))
      
      // Determinar el estado actual basado en el status de la propiedad
      const currentStatus = statusFlow.data.property.status === 'paid' ? 'Open' : 'Closed'
      
      setStatusFlow(prev => ({
        ...prev,
        data: { ...prev.data, currentStatus: currentStatus }
      }))
      
      return `✅ Property confirmed!\n\n**Current Status:** ${currentStatus}\n\nDo you want to change it?\n\nType "Yes" to change status or "No" to cancel.`
    } else if (userInput.toLowerCase().includes('no')) {
      setStatusFlow(prev => ({
        ...prev,
        step: 1,
        data: { ...prev.data, property: null }
      }))
      return '🔄 Let\'s search again.\n\nSelect the property by number (1) or address (2)'
    } else {
      return '❌ Please answer "Yes" or "No".'
    }
  }

  const processStatusChangeConfirmation = (userInput) => {
    if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('sí')) {
      setStatusFlow(prev => ({
        ...prev,
        step: 5,
        data: { ...prev.data }
      }))
      
      const currentStatus = statusFlow.data.currentStatus
      const availableStatuses = currentStatus === 'Open' ? ['Closed'] : ['Open']
      
      return `✅ Let's change the status!\n\n**Current Status:** ${currentStatus}\n\n**Available Status:** ${availableStatuses.join(', ')}\n\nPlease select the new status:\n\n1. ${availableStatuses[0]}\n\nType the number or the status name.`
    } else if (userInput.toLowerCase().includes('no')) {
      setStatusFlow({ isActive: false, step: 0, data: {} })
      return '❌ Status change cancelled. No changes were made.\n\nWhat would you like to do next?'
    } else {
      return '❌ Please answer "Yes" or "No".'
    }
  }

  const processStatusSelection = (userInput) => {
    const input = userInput.trim().toLowerCase()
    const currentStatus = statusFlow.data.currentStatus
    const availableStatuses = currentStatus === 'Open' ? ['Closed'] : ['Open']
    
    let selectedStatus = null
    
    if (input === '1' || input === availableStatuses[0].toLowerCase()) {
      selectedStatus = availableStatuses[0]
    } else if (input === 'closed' && currentStatus === 'Open') {
      selectedStatus = 'Closed'
    } else if (input === 'open' && currentStatus === 'Closed') {
      selectedStatus = 'Open'
    } else {
      return `❌ Invalid selection. Please select:\n\n1. ${availableStatuses[0]}\n\nOr type the status name directly.`
    }
    
    // Simular actualización en la base de datos
    const updatedProperties = properties.map(p => 
      p.id === statusFlow.data.property.id 
        ? { 
            ...p, 
            status: selectedStatus === 'Open' ? 'paid' : 'pending',
            lastPaid: selectedStatus === 'Open' ? new Date().toISOString().split('T')[0] : p.lastPaid
          }
        : p
    )
    
    setProperties(updatedProperties)
    setStatusFlow({ isActive: false, step: 0, data: {} })
    
    return `🎉 **Status changed successfully!**\n\nProperty Details:\n• Property ID: ${statusFlow.data.property.id}\n• Address: ${statusFlow.data.property.address}\n• Previous Status: ${currentStatus}\n• New Status: ${selectedStatus}\n• Updated Date: ${new Date().toLocaleDateString()}\n\nWhat would you like to do next?`
  }

  // Función para generar y descargar MasterList en Excel
  const generateMasterListExcel = () => {
    // Simular consulta SQL: SELECT * FROM Properties
    const allProperties = properties.map(property => ({
      'Property ID': property.id,
      'Address': property.address,
      'Owner': property.owner,
      'Tax Amount': property.taxAmount,
      'Last Paid': property.lastPaid,
      'Status': property.status === 'paid' ? 'Open' : 'Closed',
      'Generated Date': new Date().toLocaleDateString()
    }))

    // Crear contenido CSV (simulando Excel)
    const headers = Object.keys(allProperties[0]).join(',')
    const rows = allProperties.map(property => 
      Object.values(property).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    )
    
    const csvContent = [headers, ...rows].join('\n')
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `MasterList_Properties_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    return `📊 **MasterList of Properties Generated Successfully!**\n\n**File Details:**\n• File Name: MasterList_Properties_${new Date().toISOString().split('T')[0]}.csv\n• Total Properties: ${properties.length}\n• Generated Date: ${new Date().toLocaleDateString()}\n• File Format: CSV (Excel Compatible)\n\n**Properties Included:**\n${properties.map(p => `• ${p.address} (ID: ${p.id}) - ${p.status === 'paid' ? 'Open' : 'Closed'}`).join('\n')}\n\nThe file has been downloaded to your computer.\n\nWhat would you like to do next?`
  }

  // Funciones auxiliares para el flujo de Excel Report
  const startReportFlow = () => {
    setReportFlow({
      isActive: true,
      step: 1,
      data: {
        selectedFilters: [],
        filterValues: {},
        reportData: []
      }
    })
    return '📊 **Excel Report**\n\nDo you want to export the list of payments of a specific Year, Month, County, State, Property?\n\n**Available Filters:**\n1. Year\n2. Month\n3. County\n4. State\n5. Property\n\nPlease select the filters you want to use (e.g., "1,3,4" for Year, County, State)'
  }

  const processReportFilterSelection = (userInput) => {
    const selectedNumbers = userInput.match(/\d+/g)
    if (!selectedNumbers || selectedNumbers.length === 0) {
      return '❌ Please select at least one filter by number (e.g., "1,3,4").'
    }
    
    const filterOptions = ['Year', 'Month', 'County', 'State', 'Property']
    const selectedFilters = selectedNumbers.map(num => {
      const index = parseInt(num) - 1
      return filterOptions[index]
    }).filter(Boolean)
    
    if (selectedFilters.length === 0) {
      return '❌ Invalid selection. Please select valid filter numbers (1-5).'
    }
    
    setReportFlow(prev => ({
      ...prev,
      step: 2,
      data: { ...prev.data, selectedFilters }
    }))
    
    let response = `✅ Filters selected: ${selectedFilters.join(', ')}\n\nNow please provide values for each filter:\n\n`
    
    selectedFilters.forEach((filter, index) => {
      response += `**${filter}:**\n`
      if (filter === 'Year') {
        response += 'Available years: 2023, 2024\n'
      } else if (filter === 'Month') {
        response += 'Available months: 1-12 (or Jan-Dec)\n'
      } else if (filter === 'County') {
        response += 'Available counties: ' + counties.map(c => c.county_name).join(', ') + '\n'
      } else if (filter === 'State') {
        response += 'Available states: TX, CA, NY, FL\n'
      } else if (filter === 'Property') {
        response += 'Available properties: ' + properties.map(p => `${p.id} (${p.address})`).join(', ') + '\n'
      }
      response += '\n'
    })
    
    response += 'Please provide values separated by commas in the same order (e.g., "2024, Harris County, TX")'
    
    return response
  }

  const processReportFilterValues = (userInput) => {
    const values = userInput.split(',').map(v => v.trim())
    const selectedFilters = reportFlow.data.selectedFilters
    
    if (values.length !== selectedFilters.length) {
      return `❌ Please provide exactly ${selectedFilters.length} values for the selected filters: ${selectedFilters.join(', ')}`
    }
    
    const filterValues = {}
    selectedFilters.forEach((filter, index) => {
      filterValues[filter] = values[index]
    })
    
    setReportFlow(prev => ({
      ...prev,
      step: 3,
      data: { ...prev.data, filterValues }
    }))
    
    // Generar consulta dinámica y ejecutar
    const reportData = generateDynamicReport(filterValues)
    
    if (reportData.length === 0) {
      setReportFlow({ isActive: false, step: 0, data: {} })
      return '❌ No data found for the selected filters. Please try different criteria.\n\nWhat would you like to do next?'
    }
    
    // Generar y descargar Excel
    const fileName = generateReportExcel(reportData, filterValues)
    
    setReportFlow({ isActive: false, step: 0, data: {} })
    
    return `📊 **Excel Report Generated Successfully!**\n\n**File Details:**\n• File Name: ${fileName}\n• Total Records: ${reportData.length}\n• Generated Date: ${new Date().toLocaleDateString()}\n• File Format: CSV (Excel Compatible)\n\n**Applied Filters:**\n${Object.entries(filterValues).map(([key, value]) => `• ${key}: ${value}`).join('\n')}\n\n**Sample Data:**\n${reportData.slice(0, 3).map(record => `• ${record.address} - ${record.county_name} - $${record.amount_paid}`).join('\n')}\n\nThe file has been downloaded to your computer.\n\nWhat would you like to do next?`
  }

  const generateDynamicReport = (filterValues) => {
    // Simular consulta SQL dinámica
    // SELECT p.address, c.county_name, pt.year, pay.amount_paid, pay.payment_date
    // FROM Payments pay
    // JOIN Parcel_taxes pt ON pay.parcel_taxes_id = pt.parcel_taxes_id
    // JOIN Parcels pr ON pt.parcel_id = pr.parcel_id
    // JOIN Counties c ON pr.county_id = c.county_id
    // JOIN Properties p ON pr.property = p.property_id
    // WHERE [filtros dinámicos]
    
    let filteredPayments = payments.filter(payment => {
      const parcelTax = parcelTaxes.find(pt => pt.parcel_taxes_id === payment.parcel_taxes_id)
      if (!parcelTax) return false
      
      const parcel = parcels.find(p => p.parcel_id === parcelTax.parcel_id)
      if (!parcel) return false
      
      const county = counties.find(c => c.id === parcel.county_id)
      if (!county) return false
      
      const property = properties.find(p => p.id === parcel.property)
      if (!property) return false
      
      // Aplicar filtros
      if (filterValues.Year && parcelTax.year.toString() !== filterValues.Year) return false
      if (filterValues.Month) {
        const paymentMonth = new Date(payment.payment_date).getMonth() + 1
        const filterMonth = isNaN(filterValues.Month) ? 
          ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(filterValues.Month.toLowerCase()) + 1 :
          parseInt(filterValues.Month)
        if (paymentMonth !== filterMonth) return false
      }
      if (filterValues.County && !county.county_name.toLowerCase().includes(filterValues.County.toLowerCase())) return false
      if (filterValues.State && county.state !== filterValues.State) return false
      if (filterValues.Property && property.id.toString() !== filterValues.Property) return false
      
      return true
    })
    
    // Convertir a formato de reporte
    return filteredPayments.map(payment => {
      const parcelTax = parcelTaxes.find(pt => pt.parcel_taxes_id === payment.parcel_taxes_id)
      const parcel = parcels.find(p => p.parcel_id === parcelTax.parcel_id)
      const county = counties.find(c => c.id === parcel.county_id)
      const property = properties.find(p => p.id === parcel.property)
      
      return {
        'Property Address': property.address,
        'County': county.county_name,
        'State': county.state,
        'Year': parcelTax.year,
        'Payment Date': payment.payment_date,
        'Amount Paid': payment.amount_paid,
        'Base Amount': payment.base_amount,
        'Late Fees': payment.late_fees,
        'Transaction Fees': payment.transaction_fees,
        'Confirmation Number': payment.confirmation_number,
        'Paid By': payment.paid_by,
        'Parcel': parcel.parcel
      }
    })
  }

  const generateReportExcel = (reportData, filterValues) => {
    // Crear contenido CSV
    const headers = Object.keys(reportData[0]).join(',')
    const rows = reportData.map(record => 
      Object.values(record).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    )
    
    const csvContent = [headers, ...rows].join('\n')
    
    // Crear nombre de archivo con filtros
    const filterSuffix = Object.entries(filterValues)
      .map(([key, value]) => `${key}_${value}`)
      .join('_')
      .replace(/[^a-zA-Z0-9_]/g, '_')
    
    const fileName = `Payment_Report_${filterSuffix}_${new Date().toISOString().split('T')[0]}.csv`
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    return fileName
  }

  // Función para generar reporte completo de KPIs
  const generateKPIsReport = () => {
    // Cálculos básicos de propiedades
    const totalProperties = properties.length
    const openProperties = properties.filter(p => p.status === 'paid').length
    const closedProperties = properties.filter(p => p.status === 'pending').length
    
    // Cálculos financieros
    const totalTaxAmount = properties.reduce((sum, p) => sum + p.taxAmount, 0)
    const paidAmount = properties.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.taxAmount, 0)
    const pendingAmount = totalTaxAmount - paidAmount
    const completionPercentage = totalTaxAmount > 0 ? ((paidAmount / totalTaxAmount) * 100).toFixed(1) : 0
    
    // Cálculos de pagos
    const totalPayments = payments.length
    const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount_paid, 0)
    const totalLateFees = payments.reduce((sum, p) => sum + p.late_fees, 0)
    const totalTransactionFees = payments.reduce((sum, p) => sum + p.transaction_fees, 0)
    
    // Cálculos de bills
    const totalBills = parcelTaxes.length
    const paidBills = parcelTaxes.filter(pt => pt.status === 'paid').length
    const pendingBills = parcelTaxes.filter(pt => pt.status === 'pending').length
    const billsCompletionRate = totalBills > 0 ? ((paidBills / totalBills) * 100).toFixed(1) : 0
    
    // Cálculos por county
    const countyStats = counties.map(county => {
      const countyParcels = parcels.filter(p => p.county_id === county.id)
      const countyProperties = properties.filter(p => 
        countyParcels.some(parcel => parcel.property === p.id)
      )
      const countyPayments = payments.filter(payment => {
        const parcelTax = parcelTaxes.find(pt => pt.parcel_taxes_id === payment.parcel_taxes_id)
        if (!parcelTax) return false
        const parcel = parcels.find(p => p.parcel_id === parcelTax.parcel_id)
        return parcel && parcel.county_id === county.id
      })
      
      return {
        name: county.county_name,
        properties: countyProperties.length,
        parcels: countyParcels.length,
        payments: countyPayments.length,
        amount: countyPayments.reduce((sum, p) => sum + p.amount_paid, 0)
      }
    })
    
    // Cálculos de rendimiento
    const averagePropertyValue = totalProperties > 0 ? (totalTaxAmount / totalProperties).toFixed(0) : 0
    const averagePaymentAmount = totalPayments > 0 ? (totalPaidAmount / totalPayments).toFixed(0) : 0
    const averageLateFees = totalPayments > 0 ? (totalLateFees / totalPayments).toFixed(0) : 0
    
    // Cálculos de fechas
    const currentYear = new Date().getFullYear()
    const currentYearPayments = payments.filter(p => 
      new Date(p.payment_date).getFullYear() === currentYear
    )
    const currentYearAmount = currentYearPayments.reduce((sum, p) => sum + p.amount_paid, 0)
    
    // Cálculos de eficiencia
    const propertiesWithPayments = new Set(
      payments.map(payment => {
        const parcelTax = parcelTaxes.find(pt => pt.parcel_taxes_id === payment.parcel_taxes_id)
        if (!parcelTax) return null
        const parcel = parcels.find(p => p.parcel_id === parcelTax.parcel_id)
        return parcel ? parcel.property : null
      })
    ).size
    
    const paymentEfficiency = totalProperties > 0 ? ((propertiesWithPayments / totalProperties) * 100).toFixed(1) : 0
    
    return `📈 **KPIs Dashboard - Comprehensive Report**\n\n🏠 **PROPERTIES OVERVIEW**\n• Total Properties: ${totalProperties}\n• Open Properties: ${openProperties} (${((openProperties/totalProperties)*100).toFixed(1)}%)\n• Closed Properties: ${closedProperties} (${((closedProperties/totalProperties)*100).toFixed(1)}%)\n• Properties with Payments: ${propertiesWithPayments} (${paymentEfficiency}%)\n\n💰 **FINANCIAL SUMMARY**\n• Total Tax Amount: $${totalTaxAmount.toLocaleString()}\n• Amount Paid: $${paidAmount.toLocaleString()}\n• Amount Pending: $${pendingAmount.toLocaleString()}\n• Completion Rate: ${completionPercentage}%\n• Average Property Value: $${averagePropertyValue}\n\n💳 **PAYMENTS ANALYSIS**\n• Total Payments: ${totalPayments}\n• Total Paid Amount: $${totalPaidAmount.toLocaleString()}\n• Average Payment: $${averagePaymentAmount}\n• Total Late Fees: $${totalLateFees.toLocaleString()}\n• Total Transaction Fees: $${totalTransactionFees.toLocaleString()}\n• Average Late Fees: $${averageLateFees}\n• Current Year (${currentYear}) Payments: $${currentYearAmount.toLocaleString()}\n\n📄 **BILLS STATUS**\n• Total Bills: ${totalBills}\n• Paid Bills: ${paidBills} (${billsCompletionRate}%)\n• Pending Bills: ${pendingBills}\n• Bills Completion Rate: ${billsCompletionRate}%\n\n🏛️ **COUNTY BREAKDOWN**\n${countyStats.map(county => `• ${county.name}: ${county.properties} properties, ${county.parcels} parcels, ${county.payments} payments, $${county.amount.toLocaleString()}`).join('\n')}\n\n📊 **PERFORMANCE METRICS**\n• Payment Efficiency: ${paymentEfficiency}%\n• Average Payment per Property: $${totalProperties > 0 ? (totalPaidAmount / totalProperties).toFixed(0) : 0}\n• Late Fee Rate: ${totalPaidAmount > 0 ? ((totalLateFees / totalPaidAmount) * 100).toFixed(2) : 0}%\n• Transaction Fee Rate: ${totalPaidAmount > 0 ? ((totalTransactionFees / totalPaidAmount) * 100).toFixed(2) : 0}%\n\n📅 **Report Generated:** ${new Date().toLocaleDateString()}\n\nWhat would you like to do next?`
  }

  const processMessage = async (userMessage) => {
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    const lowerMsg = userMessage.toLowerCase()
    let response = ''

    // Global shortcuts to return to main menu
    if (["back", "menu", "home", "main", "return"].some(k => lowerMsg.includes(k))) {
      setPropertyFlow({ isActive: false, step: 0, data: {} })
      setBillFlow({ isActive: false, step: 0, data: {} })
      setPaymentFlow({ isActive: false, step: 0, data: {} })
      setStatusFlow({ isActive: false, step: 0, data: {} })
      setReportFlow({ isActive: false, step: 0, data: {} })
      setIsProcessing(false)
      return getMainMenu()
    }

    // Quick API commands to test backend endpoints from UI
    if (lowerMsg === 'api health') {
      try {
        const h = await apiService.health()
        setIsProcessing(false)
        return `✅ API Health: ${JSON.stringify(h)}`
      } catch (e) {
        setIsProcessing(false)
        return `❌ API Health error: ${e.message}`
      }
    }
    if (lowerMsg === 'api summary') {
      try {
        const r = await apiService.getPaymentsSummary()
        setIsProcessing(false)
        return `📊 Summary (API):\n${JSON.stringify(r.summary || r)}`
      } catch (e) {
        setIsProcessing(false)
        return `❌ Summary error: ${e.message}`
      }
    }
    if (lowerMsg === 'api pending') {
      try {
        const r = await apiService.getPendingBills()
        const count = (r.parcel_taxes || []).length
        setIsProcessing(false)
        return `🧾 Pending bills (API): ${count}`
      } catch (e) {
        setIsProcessing(false)
        return `❌ Pending bills error: ${e.message}`
      }
    }
    if (lowerMsg.startsWith('api pay ')) {
      try {
        const parts = lowerMsg.split(/\s+/)
        const billId = parseInt(parts[2])
        const amount = parseFloat(parts[3])
        if (!billId || !amount) {
          setIsProcessing(false)
          return '❌ Usage: api pay <parcel_taxes_id> <amount>'
        }
        const r = await apiService.registerPayment({ parcel_taxes_id: billId, amount_paid: amount })
        setIsProcessing(false)
        return `✅ Payment registered (API): id=${r.payment?.id || 'n/a'}`
      } catch (e) {
        setIsProcessing(false)
        return `❌ Register payment error: ${e.message}`
      }
    }

    // Manejar flujo activo de Add New Property
    if (propertyFlow.isActive) {
      // Subflujo de parcels
      if (propertyFlow.data.parcelSubflow?.isActive) {
        response = await processParcelDetails(userMessage)
      }
      // Verificar si el subflujo de county está activo
      else if (propertyFlow.data.countySubflow.isActive) {
        switch (propertyFlow.data.countySubflow.step) {
          case 1:
            response = processCountyName(userMessage)
            break
          case 2:
            response = processCountyState(userMessage)
            break
          case 3:
            response = processCountyDescriptor(userMessage)
            break
          case 4:
            response = await processCountyCode(userMessage)
            break
          case 5:
            response = processCountyExistsConfirmation(userMessage)
            break
          case 6:
            response = await processNewCountyName(userMessage)
            break
          default:
            response = '❌ Error in county subflow. Please start over.'
            setPropertyFlow(prev => ({
              ...prev,
              data: {
                ...prev.data,
                countySubflow: {
                  isActive: false,
                  step: 0,
                  data: {
                    countyName: '',
                    state: '',
                    descriptor: '',
                    countyCode: '',
                    existingCounty: null
                  }
                }
              }
            }))
        }
    } else {
        // Flujo principal de property
        switch (propertyFlow.step) {
          case 1:
            response = await processPropertyBasicInfo(userMessage)
            break
          case 2:
            response = processCountySelection(userMessage)
            break
          case 3:
            response = processParcelsInfo(userMessage)
            break
          case 4:
            response = processTaxInfo(userMessage)
            break
          default:
            response = '❌ Error in property flow. Please start over.'
            setPropertyFlow({ isActive: false, step: 0, data: {} })
        }
      }
    }
    // Manejar flujo activo de Add New Bill
    else if (billFlow.isActive) {
      switch (billFlow.step) {
        case 1:
          response = processBillSearchMethod(userMessage)
          break
        case 2:
          response = processBillPropertySearch(userMessage)
          break
        case 3:
          response = processBillPropertyConfirmation(userMessage)
          break
        case 4:
          response = await processBillCount(userMessage)
          break
        case 5:
          response = processBillParcelSelection(userMessage)
          break
        case 6:
          response = await processBillDetails(userMessage)
          break
        default:
          response = '❌ Error in bill flow. Please start over.'
          setBillFlow({ isActive: false, step: 0, data: {} })
      }
    }
    // Manejar flujo activo de Add New Payment
    else if (paymentFlow.isActive) {
      switch (paymentFlow.step) {
        case 1:
          response = processPaymentSearchMethod(userMessage)
          break
        case 2:
          response = processPaymentPropertySearch(userMessage)
          break
        case 3:
          response = processPaymentPropertyConfirmation(userMessage)
          break
        case 4:
          response = await processPaymentCount(userMessage)
          break
        case 5:
          response = processPaymentBillSelection(userMessage)
          break
        case 6:
          response = processPaymentDetails(userMessage)
          break
        default:
          response = '❌ Error in payment flow. Please start over.'
          setPaymentFlow({ isActive: false, step: 0, data: {} })
      }
    }
    // Manejar flujo activo de Change Property Status
    else if (statusFlow.isActive) {
      switch (statusFlow.step) {
        case 1:
          response = processStatusSearchMethod(userMessage)
          break
        case 2:
          response = processStatusPropertySearch(userMessage)
          break
        case 3:
          response = processStatusPropertyConfirmation(userMessage)
          break
        case 4:
          response = processStatusChangeConfirmation(userMessage)
          break
        case 5:
          response = processStatusSelection(userMessage)
          break
        default:
          response = '❌ Error in status flow. Please start over.'
          setStatusFlow({ isActive: false, step: 0, data: {} })
      }
    }
    // Manejar flujo activo de Excel Report
    else if (reportFlow.isActive) {
      switch (reportFlow.step) {
        case 1:
          response = processReportFilterSelection(userMessage)
          break
        case 2:
          response = processReportFilterValues(userMessage)
          break
        default:
          response = '❌ Error in report flow. Please start over.'
          setReportFlow({ isActive: false, step: 0, data: {} })
      }
    }
    // 1. Add a new property
    else if (lowerMsg.includes('1') || lowerMsg.includes('add') && lowerMsg.includes('property') || lowerMsg.includes('nueva propiedad')) {
      response = startPropertyFlow()
    }
    // 2. Add a new bill
    else if (lowerMsg.includes('2') || lowerMsg.includes('add') && lowerMsg.includes('bill') || lowerMsg.includes('nueva factura')) {
      response = startBillFlow()
    }
    // 3. Add a new payment
    else if (lowerMsg.includes('3') || lowerMsg.includes('add') && lowerMsg.includes('payment') || lowerMsg.includes('nuevo pago')) {
      response = startPaymentFlow()
    }
    // 4. Change a property status: Open - Closed
    else if (lowerMsg.includes('4') || lowerMsg.includes('change') && lowerMsg.includes('status') || lowerMsg.includes('cambiar estado')) {
      response = startStatusFlow()
    }
    // 5. MasterList of properties
    else if (lowerMsg.includes('5') || lowerMsg.includes('masterlist') || lowerMsg.includes('lista maestra')) {
      response = generateMasterListExcel()
    }
    // 6. Excel Report
    else if (lowerMsg.includes('6') || lowerMsg.includes('excel') || lowerMsg.includes('reporte')) {
      response = startReportFlow()
    }
    // 7. KPIs
    else if (lowerMsg.includes('7') || lowerMsg.includes('kpi') || lowerMsg.includes('indicadores')) {
      response = generateKPIsReport()
    }
    // Help
    else if (lowerMsg.includes('ayuda') || lowerMsg.includes('help') || lowerMsg.includes('opciones') || lowerMsg.includes('options')) {
      response = '💡 **Available options:**\n\n1️⃣ Add a new property\n2️⃣ Add a new bill\n3️⃣ Add a new payment\n4️⃣ Change a property status: Open - Closed\n5️⃣ MasterList of properties\n6️⃣ Excel Report\n7️⃣ KPIs\n\nType the number or option you need.'
    }
    // Default response
    else {
      response = '🤔 I\'m not sure I understand. Do you want:\n\n1️⃣ Add a new property\n2️⃣ Add a new bill\n3️⃣ Add a new payment\n4️⃣ Change a property status: Open - Closed\n5️⃣ MasterList of properties\n6️⃣ Excel Report\n7️⃣ KPIs\n\nType the number or "help" to see the options.'
    }

    setIsProcessing(false)
    return response
  }

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return
    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    const response = await processMessage(input)
    const assistantMessage = { role: 'assistant', content: appendFooter(response) }
    setMessages(prev => [...prev, assistantMessage])
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-80 bg-white shadow-xl p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">🏡 Property Tax Manager</h2>
          <p className="text-sm text-gray-600">Gestiona tus property taxes fácilmente</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-gray-600 mr-2">Año</label>
            <select
              className="text-xs border border-gray-300 rounded-md px-2 py-1"
              value={selectedYear}
              onChange={handleYearChange}
            >
              {[0,1,2,3].map(off => {
                const y = new Date().getFullYear() - off
                return <option key={y} value={y}>{y}</option>
              })}
            </select>
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Home className="w-4 h-4 mr-2" />
            Tus Propiedades ({properties.length})
          </h3>
          <div className="space-y-3">
            {properties.map(property => (
              <div key={property.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">{property.address}</p>
                  {(property.general_status === 'complete') ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Due: ${Number(property.amount_due_total || 0).toLocaleString()}</span>
                  <span className={"px-2 py-1 rounded-full " + ((property.general_status === 'complete') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {(property.general_status === 'complete') ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-600">Paid: ${Number(property.amount_paid_total || 0).toLocaleString()}</span>
                  <span className="text-gray-500">Año {property.year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 text-white">
          <h3 className="font-semibold mb-2 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Resumen
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total Año ({selectedYear}):</span>
              <span className="font-bold">${properties.reduce((sum, p) => sum + Number(p.amount_due_total || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Pagado:</span>
              <span className="font-bold">${properties.reduce((sum, p) => sum + Number(p.amount_paid_total || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-white/30 pt-1 mt-1">
              <span>Pendiente:</span>
              <span className="font-bold">${properties.reduce((sum, p) => {
                const due = Number(p.amount_due_total || 0)
                const paid = Number(p.amount_paid_total || 0)
                return sum + Math.max(due - paid, 0)
              }, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow-md p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">💬 Chat con tu Asistente de Taxes</h1>
          <p className="text-sm text-gray-600">Habla naturalmente para gestionar tus pagos</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={"max-w-2xl rounded-2xl px-5 py-3 " + (msg.role === 'user' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'bg-white shadow-md text-gray-800 border border-gray-200')}>
                <p className="whitespace-pre-line text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white shadow-md rounded-2xl px-5 py-3 border border-gray-200">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border-t shadow-lg p-4">
          <div className="flex items-center space-x-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje... ej: '1' o 'Add a new property'"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-full hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            Prueba: "1" o "Add a new property" o "MasterList of properties"
          </p>
        </div>
      </div>
    </div>
  )
}


