import supabase from '../supabaseClient.js'

// Properties Service
export const propertiesService = {
  // Get all properties
  async getAll() {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('id', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get property by ID
  async getById(id) {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Create new property
  async create(propertyData) {
    const { data, error } = await supabase
      .from('properties')
      .insert([propertyData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update property
  async update(id, updates) {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update property status
  async updateStatus(id, status) {
    return this.update(id, { open_closed: status })
  }
}

// Counties Service
export const countiesService = {
  // Get all counties
  async getAll() {
    const { data, error } = await supabase
      .from('counties')
      .select('*')
      .order('county_name')
    
    if (error) throw error
    return data
  },

  // Get counties by state
  async getByState(state) {
    const { data, error } = await supabase
      .from('counties')
      .select('*')
      .eq('state', state)
      .order('county_name')
    
    if (error) throw error
    return data
  },

  // Create new county
  async create(countyData) {
    const { data, error } = await supabase
      .from('counties')
      .insert([countyData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Check if county exists
  async exists(countyName, state) {
    const { data, error } = await supabase
      .from('counties')
      .select('*')
      .eq('county_name', countyName)
      .eq('state', state)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }
}

// Parcels Service
export const parcelsService = {
  // Get parcels by property
  async getByProperty(propertyId) {
    const { data, error } = await supabase
      .from('parcels')
      .select(`
        *,
        counties (
          id,
          county_name,
          state,
          descriptor,
          county
        )
      `)
      .eq('property', propertyId)
    
    if (error) throw error
    return data
  },

  // Create new parcel
  async create(parcelData) {
    const { data, error } = await supabase
      .from('parcels')
      .insert([parcelData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Parcel Taxes Service (Bills)
export const parcelTaxesService = {
  // Get pending bills by property
  async getPendingByProperty(propertyId) {
    const { data, error } = await supabase
      .from('parcel_taxes')
      .select(`
        *,
        parcels (
          id,
          parcel_id,
          property,
          county_id,
          parcel,
          counties (
            county_name,
            state
          )
        )
      `)
      .eq('status', 'pending')
      .eq('parcels.property', propertyId)
    
    if (error) throw error
    return data
  },

  // Create new bill
  async create(billData) {
    const { data, error } = await supabase
      .from('parcel_taxes')
      .insert([billData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update bill status
  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('parcel_taxes')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// Payments Service
export const paymentsService = {
  // Get payments by property
  async getByProperty(propertyId) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        parcel_taxes (
          id,
          year,
          amount_due,
          due_date,
          status,
          parcels (
            id,
            parcel_id,
            property,
            county_id,
            parcel,
            counties (
              county_name,
              state
            )
          )
        )
      `)
      .eq('parcel_taxes.parcels.property', propertyId)
    
    if (error) throw error
    return data
  },

  // Create new payment
  async create(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert([paymentData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get payments with filters
  async getFiltered(filters) {
    let query = supabase
      .from('payments')
      .select(`
        *,
        parcel_taxes (
          id,
          year,
          amount_due,
          due_date,
          status,
          parcels (
            id,
            parcel_id,
            property,
            county_id,
            parcel,
            counties (
              county_name,
              state
            ),
            properties (
              id,
              address
            )
          )
        )
      `)

    // Apply filters
    if (filters.year) {
      query = query.eq('parcel_taxes.year', filters.year)
    }
    
    if (filters.month) {
      const month = isNaN(filters.month) ? 
        ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(filters.month.toLowerCase()) + 1 :
        parseInt(filters.month)
      
      if (month >= 1 && month <= 12) {
        const startDate = new Date(filters.year || new Date().getFullYear(), month - 1, 1)
        const endDate = new Date(filters.year || new Date().getFullYear(), month, 0)
        
        query = query
          .gte('payment_date', startDate.toISOString().split('T')[0])
          .lte('payment_date', endDate.toISOString().split('T')[0])
      }
    }
    
    if (filters.county) {
      query = query.ilike('parcel_taxes.parcels.counties.county_name', `%${filters.county}%`)
    }
    
    if (filters.state) {
      query = query.eq('parcel_taxes.parcels.counties.state', filters.state)
    }
    
    if (filters.property) {
      query = query.eq('parcel_taxes.parcels.property', filters.property)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data
  }
}

// Taxes Information Service
export const taxesInformationService = {
  // Create taxes information
  async create(taxInfoData) {
    const { data, error } = await supabase
      .from('taxes_information')
      .insert([taxInfoData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

// KPIs Service
export const kpisService = {
  // Get comprehensive KPIs
  async getKPIs() {
    // Get all data in parallel
    const [properties, payments, parcelTaxes, counties] = await Promise.all([
      propertiesService.getAll(),
      supabase.from('payments').select('*'),
      supabase.from('parcel_taxes').select('*'),
      countiesService.getAll()
    ])

    if (payments.error) throw payments.error
    if (parcelTaxes.error) throw parcelTaxes.error

    return {
      properties,
      payments: payments.data,
      parcelTaxes: parcelTaxes.data,
      counties
    }
  }
}
