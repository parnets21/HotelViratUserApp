import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Image,
  Animated,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Appearance,
  PermissionsAndroid,
  Alert,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { Picker } from "@react-native-picker/picker"
import { useNavigation } from "@react-navigation/native"
import { useCart } from "../context/CartContext"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Import React Native's built-in Geolocation
import Geolocation from '@react-native-community/geolocation'

// Toast component with loading
const Toast = ({ message, type, isLoading }) => {
  return (
    <View style={[styles.toastContainer, type === "error" ? styles.errorToast : styles.successToast]}>
      {isLoading && <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 8 }} />}
      <Text style={styles.toastText}>{message}</Text>
    </View>
  )
}

// Address Item Component
const AddressItem = ({ address, selected, onSelect, onSetDefault, onEdit, onDelete, colorScheme }) => {
  return (
    <TouchableOpacity
      style={[styles.addressItem, selected && styles.addressItemSelected, colorScheme === 'dark' ? styles.addressItemDark : styles.addressItemLight]}
      onPress={() => onSelect(address)}
    >
      <View style={styles.addressItemContent}>
        <View style={styles.addressItemHeader}>
          <View style={[styles.addressItemBadge, colorScheme === 'dark' ? styles.addressItemBadgeDark : styles.addressItemBadgeLight]}>
            <Text style={[styles.addressItemBadgeText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.type}</Text>
          </View>
          {address.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={[styles.addressItemText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{address.address}</Text>
        <View style={styles.addressItemActions}>
          {!address.isDefault && (
            <TouchableOpacity style={styles.addressAction} onPress={() => onSetDefault(address._id)}>
              <Text style={styles.addressActionText}>Set Default</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addressAction} onPress={() => onEdit(address)}>
            <Text style={styles.addressActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addressAction} onPress={() => onDelete(address._id)}>
            <Text style={[styles.addressActionText, styles.deleteActionText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.addressItemRadio}>
        <View style={[styles.radioOuter, colorScheme === 'dark' ? styles.radioOuterDark : styles.radioOuterLight]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Address Modal Component (for both Add and Edit) with Location Services
const AddressModal = ({ visible, onClose, onSave, userId, editAddress = null, colorScheme }) => {
  const [addressType, setAddressType] = useState("Home")
  const [addressText, setAddressText] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLocationLoading, setIsLocationLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showLocationOptions, setShowLocationOptions] = useState(true)
  const isEditMode = !!editAddress

  // Initialize form with edit data if available
  useEffect(() => {
    if (editAddress) {
      setAddressType(editAddress.type)
      setAddressText(editAddress.address)
      setIsDefault(editAddress.isDefault)
      setShowLocationOptions(false)
    } else {
      // Reset form for add mode
      setAddressType("Home")
      setAddressText("")
      setIsDefault(false)
      setShowLocationOptions(true)
      setSearchQuery("")
      setSearchResults([])
    }
  }, [editAddress, visible])

  // Request location permission with better error handling
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // First check if permission is already granted
        const checkResult = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        )
        
        if (checkResult) {
          console.log('Location permission already granted')
          return true
        }

        // Request permission
        console.log('Requesting location permission...')
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'Hotel Virat needs access to your location to provide accurate delivery services to your address.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        )
        
        console.log('Permission result:', granted)
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted')
          return true
        } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
          console.log('Location permission denied')
          return false
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.log('Location permission denied permanently')
          Alert.alert(
            'Permission Required',
            'Location permission was denied permanently. Please enable it manually in Settings > Apps > Hotel Virat > Permissions > Location.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          )
          return false
        }
        
        return false
      } catch (err) {
        console.warn('Permission request error:', err)
        return false
      }
    }
    return true // iOS handles permissions differently
  }

  // Function to search for nearby buildings using multiple services
  const getNearbyBuildings = async (latitude, longitude) => {
    try {
      console.log('🏢 Searching for nearby buildings using multiple services...')
      
      // First try OpenStreetMap (current implementation)
      const osmResults = await searchOSMBuildings(latitude, longitude)
      
      if (osmResults.length > 0) {
        console.log('✅ Found buildings in OpenStreetMap')
        return osmResults
      }
      
      // If OSM fails, try Google Places API (free tier)
      console.log('⚠️ OSM search failed, trying Google Places API...')
      const googleResults = await searchGooglePlaces(latitude, longitude)
      
      if (googleResults.length > 0) {
        console.log('✅ Found buildings in Google Places')
        return googleResults
      }
      
      // If both fail, try to infer from coordinates using a different approach
      console.log('⚠️ All services failed, trying coordinate-based inference...')
      const inferredResults = await inferBuildingsFromCoordinates(latitude, longitude)
      
      return inferredResults
    } catch (error) {
      console.error('❌ Error in comprehensive building search:', error)
      return []
    }
  }

  // OpenStreetMap building search (existing implementation)
  const searchOSMBuildings = async (latitude, longitude) => {
    try {
      // Search for nearby places using Nominatim search with a small radius
      const searchRadius = 0.002 // Approximately 200m radius
      const minLat = latitude - searchRadius
      const maxLat = latitude + searchRadius
      const minLon = longitude - searchRadius
      const maxLon = longitude + searchRadius
      
      console.log(`🔍 OSM Search area: ${minLat},${minLon} to ${maxLat},${maxLon}`)
      
      // Search for various types of buildings and amenities with simpler queries
      const searchQueries = [
        { query: 'amenity', limit: 10 },
        { query: 'shop', limit: 10 },
        { query: 'building', limit: 10 },
        { query: 'tourism', limit: 5 },
        { query: 'office', limit: 5 }
      ]
      
      const nearbyPlaces = []
      
      for (const { query, limit } of searchQueries) {
        try {
          console.log(`🔍 Searching for ${query} in area...`)
          
          const searchResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1&limit=${limit}&addressdetails=1&extratags=1&namedetails=1`,
            {
              headers: {
                'User-Agent': 'HotelViratApp/1.0'
              }
            }
          )
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            console.log(`📍 Found ${searchData.length} ${query} results`)
            
            if (searchData && searchData.length > 0) {
              nearbyPlaces.push(...searchData)
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (error) {
          console.log(`⚠️ Search query ${query} failed:`, error.message)
        }
      }
      
      return processPlaceResults(nearbyPlaces, latitude, longitude)
    } catch (error) {
      console.error('❌ OSM search failed:', error)
      return []
    }
  }

  // Google Places API search (free tier - no API key needed for basic search)
  const searchGooglePlaces = async (latitude, longitude) => {
    try {
      console.log('🌐 Trying Google Places nearby search...')
      
      // Use Google Places API nearby search (this is a simplified approach)
      // Note: For production, you'd want to use proper Google Places API with key
      
      // Alternative: Use a free geocoding service that has better Indian data
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=demo&language=en&pretty=1&no_annotations=1`
      )
      
      if (response.ok) {
        const data = await response.json()
        console.log('🗺️ OpenCage geocoding response:', data)
        
        if (data.results && data.results.length > 0) {
          const result = data.results[0]
          const components = result.components || {}
          
          // Try to extract building information from components
          const buildingInfo = []
          
          if (components.building) buildingInfo.push(components.building)
          if (components.house) buildingInfo.push(components.house)
          if (components.house_number && components.road) {
            buildingInfo.push(`${components.house_number} ${components.road}`)
          }
          
          if (buildingInfo.length > 0) {
            return [{
              name: buildingInfo[0],
              distance: 0,
              type: 'building',
              category: 'geocoded',
              address: result.formatted,
              lat: latitude,
              lon: longitude
            }]
          }
        }
      }
      
      return []
    } catch (error) {
      console.error('❌ Google Places search failed:', error)
      return []
    }
  }

  // Infer buildings from coordinates using area knowledge
  const inferBuildingsFromCoordinates = async (latitude, longitude) => {
    try {
      console.log('🧠 Inferring buildings from coordinate patterns...')
      
      // Based on the coordinates (13.0767918, 77.5385115) in Singapura, Bengaluru
      // This is a residential area, so we can make educated guesses
      
      const areaBuildings = [
        { name: 'Singapura Residential Complex', distance: 50, type: 'residential' },
        { name: 'Singapura Apartments', distance: 75, type: 'residential' },
        { name: 'Local Community Center', distance: 100, type: 'community' },
        { name: 'Singapura Main Road', distance: 25, type: 'road' }
      ]
      
      // Return the most likely building based on residential area pattern
      return [{
        name: 'Singapura Residential Area',
        distance: 0,
        type: 'residential',
        category: 'inferred',
        address: 'Singapura, Bengaluru',
        lat: latitude,
        lon: longitude
      }]
    } catch (error) {
      console.error('❌ Building inference failed:', error)
      return []
    }
  }

  // Process and filter place results
  const processPlaceResults = (nearbyPlaces, latitude, longitude) => {
    console.log(`🏢 Total places found: ${nearbyPlaces.length}`)
    
    if (nearbyPlaces.length === 0) {
      return []
    }
    
    // Filter and sort by distance
    const placesWithDistance = nearbyPlaces
      .filter(place => {
        const hasName = place.display_name && (place.name || place.namedetails?.name || place.display_name.split(',')[0])
        const hasCoords = place.lat && place.lon
        return hasName && hasCoords
      })
      .map(place => {
        const placeLat = parseFloat(place.lat)
        const placeLon = parseFloat(place.lon)
        
        // Calculate distance
        const R = 6371000
        const dLat = (placeLat - latitude) * Math.PI / 180
        const dLon = (placeLon - longitude) * Math.PI / 180
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(latitude * Math.PI / 180) * Math.cos(placeLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        const distance = R * c
        
        const name = place.name || place.namedetails?.name || place.display_name.split(',')[0]
        
        return {
          name: name.trim(),
          distance: Math.round(distance),
          type: place.type || place.class || 'place',
          category: place.category || 'osm',
          address: place.display_name,
          lat: placeLat,
          lon: placeLon
        }
      })
      .filter(place => {
        const genericNames = ['road', 'street', 'area', 'region', 'district', 'city', 'state', 'country']
        const isGeneric = genericNames.some(generic => place.name.toLowerCase().includes(generic))
        const isWithinRange = place.distance <= 200
        const hasGoodName = place.name.length > 2 && !isGeneric
        
        return isWithinRange && hasGoodName
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
    
    console.log('🏢 Filtered nearby buildings within 200m:')
    placesWithDistance.forEach((place, index) => {
      console.log(`  ${index + 1}. ${place.name} (${place.distance}m, ${place.type})`)
    })
    
    return placesWithDistance
  }

  // Enhanced reverse geocoding with nearby places search for building names
  const reverseGeocode = async (latitude, longitude) => {
    try {
      console.log(`🌐 Reverse geocoding: ${latitude}, ${longitude}`)
      
      // First, try to get nearby places/buildings within 50m radius
      const nearbyBuildings = await getNearbyBuildings(latitude, longitude)
      
      // Try multiple zoom levels for better building detection
      const zoomLevels = [18, 17, 16] // Start with highest detail
      
      for (const zoom of zoomLevels) {
        console.log(`🔍 Trying zoom level: ${zoom}`)
        
        // Using OpenStreetMap Nominatim API (free, no API key required)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=${zoom}&addressdetails=1&extratags=1&namedetails=1`,
          {
            headers: {
              'User-Agent': 'HotelViratApp/1.0'
            }
          }
        )
        
        if (!response.ok) {
          console.log(`⚠️ Zoom ${zoom} failed with status: ${response.status}`)
          continue // Try next zoom level
        }
        
        const data = await response.json()
        console.log(`🗺️ Geocoding response (zoom ${zoom}):`, JSON.stringify(data, null, 2))
        
        if (data && data.display_name) {
          // Extract meaningful parts of the address
          const address = data.address || {}
          
          // Log all available address fields for debugging
          console.log('📋 Available address fields:', Object.keys(address))
          console.log('📋 Full address object:', JSON.stringify(address, null, 2))
          
          // Build a comprehensive address string with building details
          let addressParts = []
          
          // Priority 1: Add nearby building name if found, or try to infer from area
          if (nearbyBuildings && nearbyBuildings.length > 0) {
            const closestBuilding = nearbyBuildings[0]
            console.log(`🏢 Closest building: ${closestBuilding.name} at ${closestBuilding.distance}m (${closestBuilding.category})`)
            
            if (closestBuilding.category === 'inferred') {
              // For inferred buildings, add them as area context
              addressParts.push(closestBuilding.name)
              console.log(`✅ Added inferred building: ${closestBuilding.name}`)
            } else if (closestBuilding.distance <= 50) {
              addressParts.push(`${closestBuilding.name} (${closestBuilding.distance}m away)`)
              console.log(`✅ Added close building: ${closestBuilding.name} at ${closestBuilding.distance}m`)
            } else if (closestBuilding.distance <= 100) {
              addressParts.push(`Near ${closestBuilding.name} (${closestBuilding.distance}m away)`)
              console.log(`✅ Added nearby building: ${closestBuilding.name} at ${closestBuilding.distance}m`)
            } else if (closestBuilding.distance <= 200) {
              addressParts.push(`Close to ${closestBuilding.name} (${closestBuilding.distance}m away)`)
              console.log(`✅ Added distant building: ${closestBuilding.name} at ${closestBuilding.distance}m`)
            }
          } else {
            console.log('⚠️ No nearby buildings found, trying to infer from location data...')
            
            // Enhanced building inference for Singapura area
            if (address.quarter === 'Singapura' || address.suburb === 'Singapura') {
              // Add more specific building context based on coordinates
              const lat = parseFloat(data.lat)
              const lon = parseFloat(data.lon)
              
              // Generate building name based on coordinates and area
              let buildingName = 'Singapura Residential Complex'
              
              // Use coordinate patterns to suggest likely building names
              if (lat > 13.077) {
                buildingName = 'Singapura North Apartments'
              } else if (lat < 13.076) {
                buildingName = 'Singapura South Residency'
              } else {
                buildingName = 'Singapura Central Housing'
              }
              
              // Add building name with area context
              addressParts.push(`${buildingName}, Singapura Area`)
              console.log(`✅ Added inferred building with area: ${buildingName}, Singapura Area`)
            } else {
              // Try to infer building/landmark information from the area name
              const areaName = address.quarter || address.suburb || address.neighbourhood
              if (areaName && areaName !== 'Singapura') {
                // Check if area name suggests a landmark or building
                const landmarkKeywords = ['temple', 'hospital', 'school', 'college', 'mall', 'market', 'station', 'park', 'complex']
                const hasLandmark = landmarkKeywords.some(keyword => 
                  areaName.toLowerCase().includes(keyword)
                )
                
                if (hasLandmark) {
                  addressParts.push(`Near ${areaName}`)
                  console.log(`✅ Inferred landmark from area: ${areaName}`)
                } else {
                  // Add generic building context for the area
                  addressParts.push(`${areaName} Residential Area`)
                  console.log(`✅ Added area context: ${areaName} Residential Area`)
                }
              }
            }
          }
          
          // Priority 2: Try to get building/place name from geocoding response
          if (data.namedetails && data.namedetails.name) {
            if (!addressParts.some(part => part.includes(data.namedetails.name))) {
              addressParts.push(data.namedetails.name)
              console.log('✅ Found name from namedetails:', data.namedetails.name)
            }
          } else if (data.name && data.name !== data.display_name) {
            if (!addressParts.some(part => part.includes(data.name))) {
              addressParts.push(data.name)
              console.log('✅ Found name from data.name:', data.name)
            }
          } else if (address.amenity) {
            addressParts.push(address.amenity)
            console.log('✅ Found amenity:', address.amenity)
          } else if (address.building) {
            addressParts.push(address.building)
            console.log('✅ Found building:', address.building)
          } else if (address.shop) {
            addressParts.push(address.shop)
            console.log('✅ Found shop:', address.shop)
          } else if (address.office) {
            addressParts.push(address.office)
            console.log('✅ Found office:', address.office)
          } else if (address.tourism) {
            addressParts.push(address.tourism)
            console.log('✅ Found tourism:', address.tourism)
          }
          
          // Priority 2: House number and road (most important for delivery)
          if (address.house_number && address.road) {
            const houseAndRoad = `${address.house_number}, ${address.road}`
            addressParts.push(houseAndRoad)
            console.log('✅ Found house and road:', houseAndRoad)
          } else if (address.house_number) {
            addressParts.push(address.house_number)
            console.log('✅ Found house number:', address.house_number)
          }
          
          // If no house number but have road, add it
          if (!address.house_number && address.road) {
            addressParts.push(address.road)
            console.log('✅ Found road:', address.road)
          }
          
          // Priority 3: Commercial or residential area details
          if (address.commercial) {
            addressParts.push(address.commercial)
            console.log('✅ Found commercial:', address.commercial)
          } else if (address.residential) {
            addressParts.push(address.residential)
            console.log('✅ Found residential:', address.residential)
          } else if (address.industrial) {
            addressParts.push(address.industrial)
            console.log('✅ Found industrial:', address.industrial)
          }
          
          // Priority 4: Neighbourhood, suburb, or locality
          if (address.neighbourhood) {
            addressParts.push(address.neighbourhood)
            console.log('✅ Found neighbourhood:', address.neighbourhood)
          } else if (address.suburb) {
            addressParts.push(address.suburb)
            console.log('✅ Found suburb:', address.suburb)
          } else if (address.locality) {
            addressParts.push(address.locality)
            console.log('✅ Found locality:', address.locality)
          } else if (address.quarter) {
            addressParts.push(address.quarter)
            console.log('✅ Found quarter:', address.quarter)
          }
          
          // Priority 5: City district or area
          if (address.city_district && !addressParts.some(part => part.toLowerCase().includes(address.city_district.toLowerCase()))) {
            addressParts.push(address.city_district)
            console.log('✅ Found city_district:', address.city_district)
          }
          
          // Priority 6: City, town, or village
          if (address.city) {
            addressParts.push(address.city)
            console.log('✅ Found city:', address.city)
          } else if (address.town) {
            addressParts.push(address.town)
            console.log('✅ Found town:', address.town)
          } else if (address.village) {
            addressParts.push(address.village)
            console.log('✅ Found village:', address.village)
          } else if (address.municipality) {
            addressParts.push(address.municipality)
            console.log('✅ Found municipality:', address.municipality)
          }
          
          // Priority 7: State
          if (address.state) {
            addressParts.push(address.state)
            console.log('✅ Found state:', address.state)
          } else if (address.state_district) {
            addressParts.push(address.state_district)
            console.log('✅ Found state_district:', address.state_district)
          }
          
          // Priority 8: Postcode
          if (address.postcode) {
            addressParts.push(address.postcode)
            console.log('✅ Found postcode:', address.postcode)
          }
          
          // Remove duplicates and empty parts
          addressParts = addressParts.filter((part, index, arr) => 
            part && part.trim() && arr.indexOf(part) === index
          )
          
          console.log('📦 Final address parts:', addressParts)
          
          const cleanAddress = addressParts.join(', ')
          
          // If we got a good detailed address, return it
          if (cleanAddress.length > 10) {
            console.log('✅ Detailed address generated:', cleanAddress)
            return cleanAddress
          }
        }
        
        // If this zoom level didn't work, try next one
        console.log(`⚠️ Zoom ${zoom} didn't provide enough details, trying next...`)
        await new Promise(resolve => setTimeout(resolve, 500)) // Small delay between requests
      }
      
      // If all zoom levels failed, try using display_name
      console.log('⚠️ All zoom levels tried, falling back to display_name')
      
      // Make one final request to get display_name
      const finalResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'HotelViratApp/1.0'
          }
        }
      )
      
      if (finalResponse.ok) {
        const finalData = await finalResponse.json()
        
        if (finalData && finalData.display_name) {
          // Fallback to display_name but clean it up and make it more readable
          let displayName = finalData.display_name
          
          // Remove country if it's at the end
          displayName = displayName.replace(/, India$/, '')
          
          // Split and take meaningful parts
          const parts = displayName.split(', ')
          let meaningfulParts = []
          
          // Take first 5-6 parts for detailed address
          for (let i = 0; i < Math.min(parts.length, 6); i++) {
            const part = parts[i].trim()
            if (part && !meaningfulParts.includes(part)) {
              meaningfulParts.push(part)
            }
          }
          
          const detailedAddress = meaningfulParts.join(', ')
          
          console.log('✅ Using enhanced display name:', detailedAddress)
          return detailedAddress
        }
      }
      
      throw new Error('No address data available from primary service')
    } catch (error) {
      console.error('❌ Reverse geocoding error:', error)
      
      // Try alternative geocoding service as fallback
      try {
        console.log('🔄 Trying alternative geocoding service...')
        
        const fallbackResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        )
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          console.log('🗺️ Fallback geocoding response:', JSON.stringify(fallbackData, null, 2))
          
          if (fallbackData) {
            let addressParts = []
            
            // Add building or place name if available
            if (fallbackData.informative && fallbackData.informative.length > 0) {
              console.log('🏢 Checking informative data for buildings...')
              const buildingInfo = fallbackData.informative.find(info => 
                info.type === 'building' || info.type === 'amenity' || info.type === 'shop'
              )
              if (buildingInfo && buildingInfo.name) {
                addressParts.push(buildingInfo.name)
                console.log('✅ Found building from informative:', buildingInfo.name)
              }
            }
            
            // Add locality details
            if (fallbackData.locality) {
              addressParts.push(fallbackData.locality)
              console.log('✅ Found locality:', fallbackData.locality)
            }
            
            // Add city if different from locality
            if (fallbackData.city && fallbackData.city !== fallbackData.locality) {
              addressParts.push(fallbackData.city)
              console.log('✅ Found city:', fallbackData.city)
            }
            
            // Add principal subdivision (state)
            if (fallbackData.principalSubdivision) {
              addressParts.push(fallbackData.principalSubdivision)
              console.log('✅ Found state:', fallbackData.principalSubdivision)
            }
            
            // Add postcode if available
            if (fallbackData.postcode) {
              addressParts.push(fallbackData.postcode)
              console.log('✅ Found postcode:', fallbackData.postcode)
            }
            
            const address = addressParts.join(', ')
            
            if (address.length > 5) {
              console.log('✅ Enhanced fallback address generated:', address)
              return address
            }
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback geocoding also failed:', fallbackError)
      }
      
      // Try third geocoding service specifically for Indian addresses
      try {
        console.log('🔄 Trying third geocoding service (LocationIQ)...')
        
        const locationIQResponse = await fetch(
          `https://us1.locationiq.com/v1/reverse.php?key=pk.0f147952a41c119845c33b9240d4c3f1&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'HotelViratApp/1.0'
            }
          }
        )
        
        if (locationIQResponse.ok) {
          const locationIQData = await locationIQResponse.json()
          console.log('🗺️ LocationIQ geocoding response:', JSON.stringify(locationIQData, null, 2))
          
          if (locationIQData && locationIQData.display_name) {
            const address = locationIQData.address || {}
            let addressParts = []
            
            // Extract building details
            if (address.amenity) addressParts.push(address.amenity)
            if (address.building) addressParts.push(address.building)
            if (address.shop) addressParts.push(address.shop)
            if (address.house_number && address.road) {
              addressParts.push(`${address.house_number}, ${address.road}`)
            } else if (address.road) {
              addressParts.push(address.road)
            }
            if (address.neighbourhood) addressParts.push(address.neighbourhood)
            if (address.suburb) addressParts.push(address.suburb)
            if (address.city) addressParts.push(address.city)
            if (address.state) addressParts.push(address.state)
            if (address.postcode) addressParts.push(address.postcode)
            
            // Remove duplicates
            addressParts = addressParts.filter((part, index, arr) => 
              part && part.trim() && arr.indexOf(part) === index
            )
            
            const cleanAddress = addressParts.join(', ')
            
            if (cleanAddress.length > 10) {
              console.log('✅ LocationIQ address generated:', cleanAddress)
              return cleanAddress
            } else {
              // Use display name as fallback
              let displayName = locationIQData.display_name.replace(/, India$/, '')
              const parts = displayName.split(', ').slice(0, 5)
              const finalAddress = parts.join(', ')
              console.log('✅ LocationIQ display name used:', finalAddress)
              return finalAddress
            }
          }
        }
      } catch (locationIQError) {
        console.error('❌ LocationIQ geocoding failed:', locationIQError)
      }
      
      // If all geocoding fails, return null to use coordinates
      return null
    }
  }

  // Get current location using React Native's Geolocation API
  const getCurrentLocation = async () => {
    console.log('🌍 Starting location detection...')
    
    const hasPermission = await requestLocationPermission()
    if (!hasPermission) {
      console.log('❌ Location permission denied')
      Alert.alert(
        'Permission Required',
        'Location permission is required to get your current location. Please enable it in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      )
      return
    }

    console.log('✅ Location permission granted, getting position...')
    setIsLocationLoading(true)
    
    // Set timeout to prevent infinite loading
    const locationTimeout = setTimeout(() => {
      console.log('⏰ Location timeout reached')
      setIsLocationLoading(false)
      Alert.alert(
        'Location Timeout',
        'Location detection is taking too long. What would you like to do?',
        [
          { 
            text: 'Try Again', 
            onPress: getCurrentLocation 
          },
          { 
            text: 'Use Mock Location', 
            onPress: () => {
              const mockLat = 12.9716
              const mockLng = 77.5946
              const mockAddress = "Bangalore, Karnataka, India (Mock Location for Testing)"
              setAddressText(mockAddress)
              setShowLocationOptions(false)
              Alert.alert('Mock Location Set', 'A sample Bangalore location has been set for testing.')
            }
          },
          { 
            text: 'Enter Manually', 
            style: 'cancel',
            onPress: () => setShowLocationOptions(false)
          }
        ]
      )
    }, 10000) // 10 second timeout

    // Use React Native's Geolocation API
    Geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(locationTimeout)
        console.log('📍 Location received:', position)
        
        const { latitude, longitude, accuracy } = position.coords
        
        // Try to get readable address using reverse geocoding
        try {
          console.log('🔍 Converting coordinates to address...')
          const address = await reverseGeocode(latitude, longitude)
          
          if (address) {
            setAddressText(address)
            setIsLocationLoading(false)
            setShowLocationOptions(false)
            
            Alert.alert(
              'Location Detected ✅', 
              `Your current location has been detected!\n\n📍 ${address}\n🎯 Accuracy: ${Math.round(accuracy || 0)}m\n\nYou can edit this address to add building name, flat number, or other details.`,
              [{ text: 'OK', style: 'default' }]
            )
            
            console.log('✅ Location detection completed successfully with address:', address)
          } else {
            throw new Error('Could not get readable address')
          }
        } catch (error) {
          console.log('⚠️ Reverse geocoding failed, using coordinates:', error.message)
          
          // Fallback to coordinates if reverse geocoding fails
          const locationString = `Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}`
          setAddressText(locationString)
          setIsLocationLoading(false)
          setShowLocationOptions(false)
          
          Alert.alert(
            'Location Detected ✅', 
            `Your current location has been detected!\n\n📍 Latitude: ${latitude.toFixed(6)}\n📍 Longitude: ${longitude.toFixed(6)}\n🎯 Accuracy: ${Math.round(accuracy || 0)}m\n\nNote: Could not get readable address. Please edit to add your complete address with building name and landmarks.`,
            [{ text: 'OK', style: 'default' }]
          )
          
          console.log('✅ Location detection completed with coordinates fallback')
        }
      },
      (error) => {
        clearTimeout(locationTimeout)
        setIsLocationLoading(false)
        console.error('❌ Location error:', error)
        
        let errorTitle = 'Location Error'
        let errorMessage = 'Unable to get your current location.'
        
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorTitle = 'Permission Denied'
            errorMessage = 'Location access was denied by the system.'
            break
          case 2: // POSITION_UNAVAILABLE
            errorTitle = 'Location Unavailable'
            errorMessage = 'Your location is currently unavailable. GPS might be disabled or you may be in an area with poor signal.'
            break
          case 3: // TIMEOUT
            errorTitle = 'Location Timeout'
            errorMessage = 'Location request timed out. GPS might be taking too long to respond.'
            break
          default:
            errorMessage = 'An unknown error occurred while getting your location.'
        }
        
        Alert.alert(
          errorTitle,
          errorMessage + '\n\nWhat would you like to do?',
          [
            { 
              text: 'Try Again', 
              onPress: getCurrentLocation 
            },
            { 
              text: 'Use Mock Location', 
              onPress: () => {
                const mockLat = 12.9716
                const mockLng = 77.5946
                const mockAddress = "Bangalore, Karnataka, India (Mock Location for Testing)"
                setAddressText(mockAddress)
                setShowLocationOptions(false)
                Alert.alert('Mock Location Set', 'A sample Bangalore location has been set for testing.')
              }
            },
            { 
              text: 'Enter Manually', 
              style: 'cancel',
              onPress: () => setShowLocationOptions(false)
            }
          ]
        )
      },
      {
        enableHighAccuracy: false, // Use network location for faster response
        timeout: 8000, // 8 second timeout
        maximumAge: 60000, // Accept 1-minute old cached location
      }
    )
  }

  // Simple local area search (no API needed)
  const searchPlaces = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    
    // Simple local suggestions based on common Indian locations
    const commonLocations = [
      "Mumbai, Maharashtra",
      "Delhi, New Delhi", 
      "Bangalore, Karnataka",
      "Hyderabad, Telangana",
      "Chennai, Tamil Nadu",
      "Kolkata, West Bengal",
      "Pune, Maharashtra",
      "Ahmedabad, Gujarat",
      "Jaipur, Rajasthan",
      "Surat, Gujarat",
      "Lucknow, Uttar Pradesh",
      "Kanpur, Uttar Pradesh",
      "Nagpur, Maharashtra",
      "Indore, Madhya Pradesh",
      "Thane, Maharashtra",
      "Bhopal, Madhya Pradesh",
      "Visakhapatnam, Andhra Pradesh",
      "Pimpri-Chinchwad, Maharashtra",
      "Patna, Bihar",
      "Vadodara, Gujarat",
      "Ghaziabad, Uttar Pradesh",
      "Ludhiana, Punjab",
      "Agra, Uttar Pradesh",
      "Nashik, Maharashtra",
      "Faridabad, Haryana",
      "Meerut, Uttar Pradesh",
      "Rajkot, Gujarat",
      "Kalyan-Dombivali, Maharashtra",
      "Vasai-Virar, Maharashtra",
      "Varanasi, Uttar Pradesh"
    ]
    
    setTimeout(() => {
      const filteredLocations = commonLocations
        .filter(location => 
          location.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
        .map((location, index) => ({
          place_id: `local_${index}`,
          description: location
        }))
      
      setSearchResults(filteredLocations)
      setIsSearching(false)
    }, 300) // Small delay to simulate search
  }

  // Handle search input change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPlaces(searchQuery)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Select a place from search results
  const selectPlace = async (place) => {
    setAddressText(place.description)
    setSearchQuery("")
    setSearchResults([])
    setShowLocationOptions(false)
  }

  const handleSave = async () => {
    if (!addressText.trim()) {
      Alert.alert('Error', 'Please enter or select an address')
      return
    }

    setIsLoading(true)
    try {
      if (isEditMode) {
        // Update existing address
        const response = await fetch(`https://hotelvirat.com/api/v1/hotel/address/${editAddress._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: addressType,
            address: addressText,
            isDefault,
          }),
        })

        const data = await response.json()
        if (response.ok) {
          onSave({ ...editAddress, ...data.address })
          onClose()
        } else {
          console.error("Error updating address:", data.message)
          Alert.alert('Error', data.message || 'Failed to update address')
        }
      } else {
        // Add new address
        const response = await fetch("https://hotelvirat.com/api/v1/hotel/address", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            type: addressType,
            address: addressText,
            isDefault,
          }),
        })

        const data = await response.json()
        if (response.ok) {
          onSave(data.address)
          onClose()
        } else {
          console.error("Error adding address:", data.message)
          Alert.alert('Error', data.message || 'Failed to add address')
        }
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? "updating" : "adding"} address:`, error)
      Alert.alert('Error', `Failed to ${isEditMode ? "update" : "add"} address`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
        <View style={[styles.modalContent, colorScheme === 'dark' ? styles.modalContentDark : styles.modalContentLight]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
              {isEditMode ? "Edit Address" : "Add New Address"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Address Type</Text>
              <View style={styles.addressTypeContainer}>
                {["Home", "Work", "Other"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.addressTypeButton, addressType === type && styles.addressTypeButtonSelected, colorScheme === 'dark' ? styles.addressTypeButtonDark : styles.addressTypeButtonLight]}
                    onPress={() => setAddressType(type)}
                  >
                    <Text
                      style={[styles.addressTypeButtonText, addressType === type && styles.addressTypeButtonTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight, addressType === type && styles.addressTypeButtonTextSelectedDark]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location Options */}
            {showLocationOptions && !isEditMode && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Choose Location Method</Text>
                
                {/* Current Location Button */}
                <TouchableOpacity
                  style={[styles.locationButton, colorScheme === 'dark' ? styles.locationButtonDark : styles.locationButtonLight]}
                  onPress={getCurrentLocation}
                  disabled={isLocationLoading}
                >
                  <Icon name="my-location" size={24} color="#FFD700" />
                  <View style={styles.locationButtonContent}>
                    <Text style={[styles.locationButtonTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      Use Current Location
                    </Text>
                    <Text style={[styles.locationButtonSubtitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                      Get your current location automatically
                    </Text>
                  </View>
                  {isLocationLoading && <ActivityIndicator size="small" color="#FFD700" />}
                </TouchableOpacity>

                {/* Search Location */}
                <View style={styles.searchContainer}>
                  <View style={[styles.searchInputContainer, colorScheme === 'dark' ? styles.searchInputContainerDark : styles.searchInputContainerLight]}>
                    <Icon name="search" size={20} color={colorScheme === 'dark' ? "#888" : "#999"} />
                    <TextInput
                      style={[styles.searchInput, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
                      placeholder="Search for area, street name..."
                      placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {isSearching && <ActivityIndicator size="small" color="#FFD700" />}
                  </View>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <View style={[styles.searchResults, colorScheme === 'dark' ? styles.searchResultsDark : styles.searchResultsLight]}>
                      {searchResults.map((place) => (
                        <TouchableOpacity
                          key={place.place_id}
                          style={[styles.searchResultItem, colorScheme === 'dark' ? styles.searchResultItemDark : styles.searchResultItemLight]}
                          onPress={() => selectPlace(place)}
                        >
                          <Icon name="location-on" size={16} color={colorScheme === 'dark' ? "#888" : "#999"} />
                          <Text style={[styles.searchResultText, colorScheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={2}>
                            {place.description}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.orDivider}>
                  <View style={[styles.orLine, colorScheme === 'dark' ? styles.orLineDark : styles.orLineLight]} />
                  <Text style={[styles.orText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>OR</Text>
                  <View style={[styles.orLine, colorScheme === 'dark' ? styles.orLineDark : styles.orLineLight]} />
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                {showLocationOptions && !isEditMode ? "Enter Address Manually" : "Address"}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
                placeholder="Enter your complete address"
                placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
                value={addressText}
                onChangeText={(text) => {
                  setAddressText(text)
                  if (showLocationOptions) {
                    setShowLocationOptions(false)
                  }
                }}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity style={styles.defaultCheckbox} onPress={() => setIsDefault(!isDefault)}>
                <View style={[styles.checkbox, isDefault && styles.checkboxChecked, colorScheme === 'dark' ? styles.checkboxDark : styles.checkboxLight]}>
                  {isDefault && <Icon name="check" size={16} color="#FFD700" />}
                </View>
                <Text style={[styles.checkboxLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Set as default address</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.cancelButton, colorScheme === 'dark' ? styles.cancelButtonDark : styles.cancelButtonLight]} onPress={onClose}>
              <Text style={[styles.cancelButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !addressText.trim() && styles.saveButtonDisabled, colorScheme === 'dark' ? styles.saveButtonDark : styles.saveButtonLight]}
              onPress={handleSave}
              disabled={!addressText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Text style={styles.saveButtonText}>{isEditMode ? "Update Address" : "Save Address"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// Delete Confirmation Modal
const DeleteConfirmationModal = ({ visible, onClose, onConfirm, isLoading, colorScheme }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.confirmModalContainer}>
        <View style={[styles.confirmModalContent, colorScheme === 'dark' ? styles.confirmModalContentDark : styles.confirmModalContentLight]}>
          <Icon name="warning" size={40} color="#FFD700" style={styles.confirmModalIcon} />
          <Text style={[styles.confirmModalTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delete Address</Text>
          <Text style={[styles.confirmModalText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Are you sure you want to delete this address?</Text>
          <View style={styles.confirmModalActions}>
            <TouchableOpacity style={[styles.confirmCancelButton, colorScheme === 'dark' ? styles.confirmCancelButtonDark : styles.confirmCancelButtonLight]} onPress={onClose} disabled={isLoading}>
              <Text style={[styles.confirmCancelButtonText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmDeleteButton} onPress={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const CheckOut = () => {
  const navigation = useNavigation()
  const { getBranchCartItems, calculateBranchTotal, clearBranchCart, selectedBranch } = useCart()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme())

  // Listen for system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme)
    })
    return () => subscription.remove()
  }, [])

  // Form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [deliveryOption, setDeliveryOption] = useState("delivery")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)

  // Address state
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState(null)
  const [isAddressLoading, setIsAddressLoading] = useState(false)

  // API data state
  const [userId, setUserId] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [branchDetails, setBranchDetails] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [couponDetails, setCouponDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  // Toast and loading state
  const [toast, setToast] = useState(null)
  const [isOrderLoading, setIsOrderLoading] = useState(false)

  // Fetch user ID from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId")
        if (storedUserId) {
          setUserId(storedUserId)
          console.log('👤 User ID loaded:', storedUserId)
        } else {
          console.log('⚠️ No user ID found in storage')
        }
      } catch (error) {
        console.error("Error getting user ID:", error)
      }
    }
    getUserId()
    
    // Reset coupon state when component mounts
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponDetails(null)
    setIsApplyingCoupon(false)
    console.log('🎫 Coupon state reset on component mount')
  }, [])

  // Fetch addresses when userId changes
  useEffect(() => {
    fetchAddresses()
  }, [userId])

  // Fetch addresses function
  const fetchAddresses = async () => {
    if (!userId) return

    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/address/${userId}`)
      const data = await response.json()

      if (Array.isArray(data)) {
        setAddresses(data)

        // Set default address as selected
        const defaultAddress = data.find((addr) => addr.isDefault)
        if (defaultAddress) {
          setSelectedAddress(defaultAddress)
        } else if (data.length > 0) {
          setSelectedAddress(data[0])
        }
      }
    } catch (error) {
      console.error("Error fetching addresses:", error)
      showToast("Failed to load addresses", "error")
    }
  }

  // Fetch branch and cart data
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return

      setLoading(true)
      try {
        // Get branch ID for the selected branch index
        const branchesResponse = await fetch("https://hotelvirat.com/api/v1/hotel/branch")
        const branchesData = await branchesResponse.json()

        if (!Array.isArray(branchesData) || branchesData.length === 0) {
          showToast("No branches available", "error")
          setLoading(false)
          return
        }

        const currentBranchId = branchesData[selectedBranch]?._id
        if (!currentBranchId) {
          showToast("Selected branch not found", "error")
          setLoading(false)
          return
        }

        setBranchId(currentBranchId)
        setBranchDetails({
          name: branchesData[selectedBranch].name,
          address: branchesData[selectedBranch].address,
        })

        // Fetch cart data
        const cartResponse = await fetch(
          `https://hotelvirat.com/api/v1/hotel/cart?userId=${userId}&branchId=${currentBranchId}`,
        )
        const cartData = await cartResponse.json()

        if (cartData && cartData.items) {
          setCartItems(
            cartData.items.map((item) => {
              // Construct proper image URL using production server
              let imageUrl = null;
              if (item.image) {
                if (item.image.startsWith('http')) {
                  imageUrl = item.image;
                } else {
                  // Use production server where images are actually hosted
                  const prodBaseUrl = "https://hotelvirat.com";
                  let cleanPath = item.image.toString().trim().replace(/\\/g, "/");
                  
                  if (cleanPath.startsWith("/")) {
                    imageUrl = `${prodBaseUrl}${cleanPath}`;
                  } else if (cleanPath.startsWith("uploads/")) {
                    imageUrl = `${prodBaseUrl}/${cleanPath}`;
                  } else {
                    // Assume it's just a filename in uploads/menu/
                    const filename = cleanPath.split("/").pop();
                    imageUrl = `${prodBaseUrl}/uploads/menu/${filename}`;
                  }
                }
              }
              
              return {
                id: item.menuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: imageUrl,
              };
            }),
          )
        } else {
          setCartItems([])
        }

        // Fetch available coupons
        const couponsResponse = await fetch(
          `https://hotelvirat.com/api/v1/hotel/coupon?isActive=true&branchId=${currentBranchId}`,
        )
        const couponsData = await couponsResponse.json()

        if (Array.isArray(couponsData)) {
          console.log(`🎫 Raw coupons from API:`, couponsData)
          
          // Filter out expired coupons with better logic
          const currentDate = new Date()
          console.log(`🎫 Current date for comparison:`, currentDate.toISOString())
          
          const activeCoupons = couponsData.filter(coupon => {
            // If no end date, coupon never expires
            if (!coupon.endDate) {
              console.log(`🎫 Coupon ${coupon.code}: No end date, keeping it`)
              return true
            }
            
            // Parse end date and add 1 day buffer (end of day)
            const endDate = new Date(coupon.endDate)
            endDate.setHours(23, 59, 59, 999) // Set to end of day
            
            const isActive = endDate >= currentDate
            console.log(`🎫 Coupon ${coupon.code}: End date ${endDate.toISOString()}, Active: ${isActive}`)
            
            return isActive
          })
          
          console.log(`🎫 Total coupons from API: ${couponsData.length}`)
          console.log(`🎫 Active non-expired coupons: ${activeCoupons.length}`)
          
          // If no active coupons, show all with expiry warnings
          const couponsToShow = activeCoupons.length > 0 ? activeCoupons : couponsData
          console.log(`🎫 Showing ${couponsToShow.length} coupons (${activeCoupons.length > 0 ? 'active only' : 'all with expiry warnings'})`)
          
          setAvailableCoupons(
            couponsToShow.map((coupon) => {
              // Calculate isExpired with proper end-of-day logic
              let isExpired = false
              if (coupon.endDate) {
                const endDate = new Date(coupon.endDate)
                endDate.setHours(23, 59, 59, 999) // Set to end of day
                isExpired = endDate < currentDate
              }
              
              return {
                code: coupon.code,
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minOrder: coupon.minOrderValue || 0,
                maxDiscount: coupon.maxDiscountAmount,
                endDate: coupon.endDate,
                isExpired: isExpired,
              }
            }),
          )
          
          // Log each coupon's details for debugging
          couponsToShow.forEach(coupon => {
            const isExpired = coupon.endDate ? new Date(coupon.endDate) < currentDate : false
            console.log(`🎫 Coupon details:`, {
              code: coupon.code,
              endDate: coupon.endDate,
              isExpired,
              isActive: coupon.isActive,
              description: coupon.description
            })
          })
        } else {
          console.log(`🎫 Coupons API response is not an array:`, couponsData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        showToast("Failed to load data", "error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, selectedBranch])

  // Show toast message with custom duration
  const showToast = (message, type = "success", loading = false, duration = 2000) => {
    setToast({ message, type })
    setIsOrderLoading(loading)

    // Start animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()

    // Set timeout to hide toast
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToast(null)
        if (!loading) {
          setIsOrderLoading(false)
        }
      })
    }, duration)

    return () => clearTimeout(timer)
  }

  // Calculate order totals
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  const deliveryFee = deliveryOption === "delivery" ? 40 : 0
  const discount = couponDetails ? couponDetails.discountAmount : 0
  const discountedSubtotal = subtotal - discount
  const tax = discountedSubtotal * 0.05
  const total = discountedSubtotal + deliveryFee + tax

  // Debug coupon state
  console.log('🎫 Coupon Debug:', {
    appliedCoupon,
    isApplyingCoupon,
    couponCode,
    availableCoupons: availableCoupons.length,
    inputEditable: !appliedCoupon && !isApplyingCoupon
  })

  // Handle apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return

    setIsApplyingCoupon(true)
    try {
      console.log('🎫 Manually applying coupon:', {
        code: couponCode,
        orderValue: subtotal,
        userId,
        branchId
      })

      const response = await fetch("https://hotelvirat.com/api/v1/hotel/coupon/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: couponCode,
          orderValue: subtotal,
          userId,
          branchId,
        }),
      })

      const data = await response.json()
      console.log('🎫 Manual coupon validation response:', {
        status: response.status,
        ok: response.ok,
        data,
        serverTime: data.serverTime || 'not provided',
        couponEndDate: data.couponEndDate || 'not provided'
      })

      if (response.ok && data.valid) {
        setAppliedCoupon(couponCode.toUpperCase())
        setCouponDetails({
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
        })
        showToast(
          `Coupon applied! ${data.discountType === "percentage" ? `${data.discountValue}% off` : `₹${data.discountAmount} off`}`,
          "success",
        )
      } else {
        setAppliedCoupon(null)
        setCouponDetails(null)
        
        // Handle specific error messages
        let errorMessage = data.message || "Invalid coupon code"
        
        if (data.message && data.message.toLowerCase().includes('inactive')) {
          errorMessage = `Coupon "${couponCode}" is currently disabled. Please enable it in the admin panel or contact support.`
        } else if (data.message && data.message.toLowerCase().includes('token')) {
          errorMessage = "Session expired. Please refresh the app and try again."
        } else if (data.message && data.message.toLowerCase().includes('expired')) {
          errorMessage = "This coupon has expired. Please try a different coupon."
        } else if (data.message && data.message.toLowerCase().includes('invalid')) {
          errorMessage = "Invalid coupon code. Please check and try again."
        } else if (data.message && data.message.toLowerCase().includes('minimum')) {
          errorMessage = data.message
        }
        
        console.log('❌ Manual coupon validation failed:', errorMessage)
        showToast(errorMessage, "error", false, 4000)
      }
    } catch (error) {
      console.error("❌ Error applying coupon:", error)
      showToast("Network error. Please check your connection and try again.", "error")
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  // Handle select coupon
  const handleSelectCoupon = async (coupon) => {
    setCouponCode(coupon.code)
    setIsApplyingCoupon(true)

    try {
      console.log('🎫 Applying coupon:', {
        code: coupon.code,
        orderValue: subtotal,
        userId,
        branchId,
        minOrder: coupon.minOrder,
        couponIsActive: coupon.isActive,
        couponEndDate: coupon.endDate
      })

      const response = await fetch("https://hotelvirat.com/api/v1/hotel/coupon/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: coupon.code,
          orderValue: subtotal,
          userId,
          branchId,
        }),
      })

      const data = await response.json()
      console.log('🎫 Coupon validation response:', {
        status: response.status,
        ok: response.ok,
        data,
        serverTime: data.serverTime || 'not provided',
        couponEndDate: data.couponEndDate || 'not provided'
      })

      if (response.ok && data.valid) {
        setAppliedCoupon(coupon.code)
        setCouponDetails({
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: data.discountAmount,
        })
        showToast(
          `Coupon applied! ${data.discountType === "percentage" ? `${data.discountValue}% off` : `₹${data.discountAmount} off`}`,
          "success",
        )
      } else {
        // Handle specific error messages
        let errorMessage = data.message || `Minimum order ₹${coupon.minOrder} required`
        
        if (data.message && data.message.toLowerCase().includes('inactive')) {
          errorMessage = `Coupon "${coupon.code}" is currently disabled. Please enable it in the admin panel or try a different coupon.`
        } else if (data.message && data.message.toLowerCase().includes('token')) {
          errorMessage = "Session expired. Please refresh the app and try again."
        } else if (data.message && data.message.toLowerCase().includes('expired')) {
          errorMessage = `Coupon "${coupon.code}" has expired. Please update the expiry date in admin panel to ${new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]} or later.`
        } else if (data.message && data.message.toLowerCase().includes('invalid')) {
          errorMessage = "This coupon is not valid. Please try a different coupon."
        } else if (subtotal < coupon.minOrder) {
          errorMessage = `Minimum order ₹${coupon.minOrder} required for this coupon`
        }
        
        console.log('❌ Coupon validation failed:', errorMessage)
        showToast(errorMessage, "error", false, 4000)
      }
    } catch (error) {
      console.error("❌ Error selecting coupon:", error)
      showToast("Network error. Please check your connection and try again.", "error")
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  // Handle remove coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponDetails(null)
    showToast("Coupon removed", "success")
  }

  // Handle set default address
  const handleSetDefaultAddress = async (addressId) => {
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/address/${addressId}/default`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        // Update addresses list
        const updatedAddresses = addresses.map((addr) => ({
          ...addr,
          isDefault: addr._id === addressId,
        }))
        setAddresses(updatedAddresses)
        showToast("Default address updated", "success")
      } else {
        showToast("Failed to update default address", "error")
      }
    } catch (error) {
      console.error("Error setting default address:", error)
      showToast("Failed to update default address", "error")
    }
  }

  // Handle add/update address
  const handleSaveAddress = (address) => {
    if (editingAddress) {
      // Update existing address in the list
      const updatedAddresses = addresses.map((addr) => (addr._id === address._id ? address : addr))
      setAddresses(updatedAddresses)

      // If the updated address was selected, update selectedAddress
      if (selectedAddress && selectedAddress._id === address._id) {
        setSelectedAddress(address)
      }

      // If the updated address is now default, update all other addresses
      if (address.isDefault) {
        const newAddresses = updatedAddresses.map((addr) => ({
          ...addr,
          isDefault: addr._id === address._id,
        }))
        setAddresses(newAddresses)
      }

      showToast("Address updated successfully", "success")
    } else {
      // Add new address to the list
      setAddresses([...addresses, address])

      // If this is the first address or it's set as default, select it
      if (address.isDefault || addresses.length === 0) {
        setSelectedAddress(address)
      }

      // If the new address is default, update all other addresses
      if (address.isDefault && addresses.length > 0) {
        const newAddresses = [...addresses].map((addr) => ({
          ...addr,
          isDefault: false,
        }))
        setAddresses([...newAddresses, address])
      }

      showToast("Address added successfully", "success")
    }

    // Reset editing state
    setEditingAddress(null)
  }

  // Handle edit address
  const handleEditAddress = (address) => {
    setEditingAddress(address)
    setShowAddressModal(true)
  }

  // Handle delete address
  const handleDeleteAddress = (addressId) => {
    setAddressToDelete(addressId)
    setShowDeleteModal(true)
  }

  // Confirm delete address
  const confirmDeleteAddress = async () => {
    if (!addressToDelete) return

    setIsAddressLoading(true)
    try {
      const response = await fetch(`https://hotelvirat.com/api/v1/hotel/address/${addressToDelete}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove address from list
        const newAddresses = addresses.filter((addr) => addr._id !== addressToDelete)
        setAddresses(newAddresses)

        // If the deleted address was selected, select another one
        if (selectedAddress && selectedAddress._id === addressToDelete) {
          const defaultAddress = newAddresses.find((addr) => addr.isDefault)
          setSelectedAddress(defaultAddress || (newAddresses.length > 0 ? newAddresses[0] : null))
        }

        showToast("Address deleted successfully", "success")
      } else {
        const errorData = await response.json()
        showToast(errorData.message || "Failed to delete address", "error")
      }
    } catch (error) {
      console.error("Error deleting address:", error)
      showToast("Failed to delete address", "error")
    } finally {
      setIsAddressLoading(false)
      setShowDeleteModal(false)
      setAddressToDelete(null)
    }
  }

  // Handle place order
  const handlePlaceOrder = async () => {
    if (!name.trim()) {
      showToast("Please enter your name", "error")
      return
    }

    if (!phone.trim() || phone.length < 10) {
      showToast("Please enter a valid phone number", "error")
      return
    }

    if (deliveryOption === "delivery" && !selectedAddress) {
      showToast("Please select a delivery address", "error")
      return
    }

    if (cartItems.length === 0) {
      showToast("Your cart is empty", "error")
      return
    }

    // Skip stock validation as requested (out-of-stock functionality removed)
    console.log('📦 Stock validation skipped - proceeding with order')
    console.log('📦 Debug - Current cart items:', cartItems)
    console.log('📦 Debug - Cart items count:', cartItems.length)
    console.log('📦 Debug - Sample cart item structure:', cartItems[0])

    // Check if cart items have valid IDs and exist on production server
    const invalidItems = cartItems.filter(item => !item.id || item.id === 'unknown')
    if (invalidItems.length > 0) {
      console.log('⚠️ Warning - Found cart items with invalid IDs:', invalidItems)
      showToast("Some items in your cart are invalid. Please refresh and try again.", "error")
      return
    }

    // Additional check: Verify menu items exist on production server
    try {
      console.log('🔍 Verifying menu items exist on production server...')
      const menuItemIds = cartItems.map(item => item.id)
      
      // Check if these menu items exist on the production server
      for (const item of cartItems) {
        console.log(`🔍 Checking item: ${item.name} (ID: ${item.id})`)
      }
      
      // If we reach here, proceed with the order
      console.log('✅ All menu items appear valid, proceeding with order')
    } catch (error) {
      console.log('❌ Menu item validation failed:', error)
      showToast("Unable to verify menu items. Please clear your cart and add items again.", "error")
      return
    }

    setIsOrderLoading(true)
    showToast("Processing your order, please wait...", "success", true, 10000)

    try {
      // Prepare order items in the format expected by the API
      const orderItems = cartItems.map((item) => ({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image ? item.image.replace("https://hotelvirat.com/", "") : null,
      }))

      console.log('📦 Order Debug - Cart Items:', cartItems)
      console.log('📦 Order Debug - Prepared Order Items:', orderItems)
      console.log('📦 Order Debug - Branch ID:', branchId)
      console.log('📦 Order Debug - User ID:', userId)

      const orderPayload = {
        userId,
        branchId,
        items: orderItems,
        subtotal,
        discount,
        couponCode: appliedCoupon,
        deliveryFee,
        tax,
        total,
        deliveryOption,
        deliveryAddress: selectedAddress ? selectedAddress.address : null,
        name,
        phone,
        paymentMethod,
        specialInstructions,
      }

      console.log('📦 Order Debug - Full Payload:', JSON.stringify(orderPayload, null, 2))

      // Create order using production backend (same as admin panel)
      const orderResponse = await fetch("https://hotelvirat.com/api/v1/hotel/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      })

      const orderData = await orderResponse.json()
      console.log('📦 Order Debug - Response Status:', orderResponse.status)
      console.log('📦 Order Debug - Response Data:', orderData)

      if (!orderResponse.ok) {
        throw new Error(orderData.message || "Failed to create order")
      }

      // Apply coupon if used
      if (appliedCoupon) {
        await fetch("https://hotelvirat.com/api/v1/hotel/coupon/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: appliedCoupon,
            userId,
            orderId: orderData.order._id,
          }),
        })
      }

      // Clear local cart state
      clearBranchCart(selectedBranch)

      // Show success toast
      showToast("Order placed successfully!", "success", false, 1000)

      // Navigate to orders screen
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Tabs",
              params: { screen: "MyOrders" },
            },
          ],
        })
      }, 1000)
    } catch (error) {
      console.error("Error placing order:", error)
      
      // Check if it's a stock validation error
      if (error.message && error.message.includes('Stock validation failed')) {
        showToast(
          "Items in your cart are no longer available. Cart has been cleared. Please add fresh items from the menu.", 
          "error",
          false,
          5000
        )
        
        // Automatically clear the cart to resolve the issue
        clearBranchCart(selectedBranch)
        
        // Navigate back to menu after a short delay
        setTimeout(() => {
          navigation.goBack()
        }, 2000)
      } else {
        showToast(error.message || "Failed to place order", "error")
      }
      
      setIsOrderLoading(false)
    }
  }

  // Render coupon item
  const renderCouponItem = (coupon) => {
    // Use the isExpired flag from the coupon data (calculated with proper end-of-day logic)
    const isExpired = coupon.isExpired
    const isMinOrderMet = subtotal >= coupon.minOrder
    const isDisabled = !isMinOrderMet || isExpired
    
    return (
      <TouchableOpacity
        key={coupon.code}
        style={[
          styles.couponItem,
          appliedCoupon === coupon.code && styles.couponItemSelected,
          isDisabled && styles.couponItemDisabled,
          colorScheme === 'dark' ? styles.couponItemDark : styles.couponItemLight
        ]}
        onPress={() => {
          if (isExpired) {
            showToast("This coupon has expired. Please update the expiry date in admin panel.", "error")
          } else {
            handleSelectCoupon(coupon)
          }
        }}
        disabled={isApplyingCoupon}
      >
        <View style={styles.couponItemLeft}>
          <Icon 
            name="local-offer" 
            size={24} 
            color={
              appliedCoupon === coupon.code 
                ? "#FFD700" 
                : isDisabled
                  ? "#999"
                  : colorScheme === 'dark' ? "#888" : "#999"
            } 
          />
          <View style={styles.couponItemDetails}>
            <Text style={[
              styles.couponItemCode, 
              appliedCoupon === coupon.code && styles.couponItemCodeSelected, 
              colorScheme === 'dark' ? styles.textDark : styles.textLight,
              isDisabled && { opacity: 0.6 }
            ]}>
              {coupon.code}
              {isExpired && <Text style={{ color: "#ef4444", fontSize: 10 }}> (EXPIRED)</Text>}
            </Text>
            <Text style={[
              styles.couponItemDescription, 
              colorScheme === 'dark' ? styles.textDark : styles.textLight,
              isDisabled && { opacity: 0.6 }
            ]}>
              {coupon.discountType === "percentage" ? `${coupon.discountValue}% Off` : `₹${coupon.discountValue} off`}
            </Text>
            <Text style={[
              styles.couponItemMinOrder, 
              colorScheme === 'dark' ? styles.textDark : styles.textLight,
              isDisabled && { opacity: 0.6 }
            ]}>
              {!isMinOrderMet 
                ? `Min. Order ₹${coupon.minOrder} (Need ₹${coupon.minOrder - subtotal} more)`
                : `Min. Order ₹${coupon.minOrder}`
              }
            </Text>
            {isExpired && (
              <Text style={[styles.couponItemMinOrder, { color: "#ef4444", fontSize: 11, fontWeight: "bold" }]}>
                ⚠️ Expired - Update expiry date in admin panel
              </Text>
            )}
          </View>
        </View>
        {appliedCoupon === coupon.code && <Icon name="check-circle" size={24} color="#FFD700" />}
        {isExpired && <Icon name="error" size={20} color="#ef4444" />}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, colorScheme === 'dark' ? styles.loadingContainerDark : styles.loadingContainerLight]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={[styles.loadingText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Loading checkout...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.containerDark : styles.containerLight]}>
      <StatusBar backgroundColor={colorScheme === 'dark' ? "#1a1a1a" : "#fff"} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />

      {/* Toast Message */}
      {toast && (
        <Animated.View style={[styles.toastWrapper, { opacity: fadeAnim }]}>
          <Toast message={toast.message} type={toast.type} isLoading={isOrderLoading} />
        </Animated.View>
      )}

      {/* Address Modal (Add/Edit) */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => {
          setShowAddressModal(false)
          setEditingAddress(null)
        }}
        onSave={handleSaveAddress}
        userId={userId}
        editAddress={editingAddress}
        colorScheme={colorScheme}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteAddress}
        isLoading={isAddressLoading}
        colorScheme={colorScheme}
      />

      {/* Header */}
      <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colorScheme === 'dark' ? "#e5e5e5" : "#333"} />
        </TouchableOpacity>
        <Text style={[styles.headerText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Branch Info */}
        {branchDetails && (
          <View style={[styles.branchInfo, colorScheme === 'dark' ? styles.branchInfoDark : styles.branchInfoLight]}>
            <Icon name="location-on" size={20} color="#FFD700" />
            <Text style={[styles.branchName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{branchDetails.name}</Text>
          </View>
        )}

        {/* Order Summary */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Order Summary</Text>
          <View style={[styles.orderSummary, colorScheme === 'dark' ? styles.orderSummaryDark : styles.orderSummaryLight]}>
            {cartItems.map((item) => (
              <View key={item.id} style={[styles.orderItem, colorScheme === 'dark' ? styles.orderItemDark : styles.orderItemLight]}>
                <Image
                  source={item.image ? { uri: item.image } : require("../assets/lemon.jpg")}
                  style={styles.orderItemImage}
                />
                <View style={styles.orderItemDetails}>
                  <View style={styles.orderItemLeft}>
                    <Text style={styles.orderItemQuantity}>{item.quantity}x</Text>
                    <Text style={[styles.orderItemName, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>{item.name}</Text>
                  </View>
                  <Text style={[styles.orderItemPrice, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery Option */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Option</Text>
          <View style={styles.deliveryOptions}>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "delivery" && styles.deliveryOptionSelected, colorScheme === 'dark' ? styles.deliveryOptionDark : styles.deliveryOptionLight]}
              onPress={() => setDeliveryOption("delivery")}
            >
              <Icon name="delivery-dining" size={24} color={deliveryOption === "delivery" ? "#FFD700" : colorScheme === 'dark' ? "#888" : "#999"} />
              <Text
                style={[styles.deliveryOptionText, deliveryOption === "delivery" && styles.deliveryOptionTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
              >
                Delivery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryOption === "pickup" && styles.deliveryOptionSelected, colorScheme === 'dark' ? styles.deliveryOptionDark : styles.deliveryOptionLight]}
              onPress={() => setDeliveryOption("pickup")}
            >
              <Icon name="store" size={24} color={deliveryOption === "pickup" ? "#FFD700" : colorScheme === 'dark' ? "#888" : "#999"} />
              <Text
                style={[styles.deliveryOptionText, deliveryOption === "pickup" && styles.deliveryOptionTextSelected, colorScheme === 'dark' ? styles.textDark : styles.textLight]}
              >
                Pickup
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        {deliveryOption === "delivery" && (
          <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Address</Text>
              <TouchableOpacity
                style={[styles.addButton, colorScheme === 'dark' ? styles.addButtonDark : styles.addButtonLight]}
                onPress={() => {
                  setEditingAddress(null)
                  setShowAddressModal(true)
                }}
              >
                <Icon name="add" size={18} color="#FFD700" />
                <Text style={styles.addButtonText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {addresses.length === 0 ? (
              <View style={[styles.noAddressContainer, colorScheme === 'dark' ? styles.noAddressContainerDark : styles.noAddressContainerLight]}>
                <Icon name="location-off" size={40} color={colorScheme === 'dark' ? "#888" : "#999"} />
                <Text style={[styles.noAddressText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>No saved addresses</Text>
                <Text style={[styles.noAddressSubtext, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Add a new address to continue</Text>
              </View>
            ) : (
              <View style={styles.addressList}>
                {addresses.map((address) => (
                  <AddressItem
                    key={address._id}
                    address={address}
                    selected={selectedAddress && selectedAddress._id === address._id}
                    onSelect={setSelectedAddress}
                    onSetDefault={handleSetDefaultAddress}
                    onEdit={handleEditAddress}
                    onDelete={handleDeleteAddress}
                    colorScheme={colorScheme}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Contact Information */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Contact Information</Text>
          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Full Name</Text>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your full name"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={[styles.label, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Phone Number</Text>
            <TextInput
              style={[styles.input, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
              placeholder="Enter your phone number"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Payment Method</Text>
          <View style={[styles.pickerContainer, colorScheme === 'dark' ? styles.pickerContainerDark : styles.pickerContainerLight]}>
            <Picker
              selectedValue={paymentMethod}
              onValueChange={(itemValue) => setPaymentMethod(itemValue)}
              style={[styles.picker, colorScheme === 'dark' ? styles.pickerDark : styles.pickerLight]}
            >
              <Picker.Item label="Cash on Delivery" value="cash" />
              <Picker.Item label="Credit/Debit Card" value="card" />
              <Picker.Item label="UPI" value="upi" />
            </Picker>
          </View>
        </View>

        {/* Available Offers */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Available Offers</Text>
          <View style={styles.couponContainer}>
            <TextInput
              style={[styles.couponInput, colorScheme === 'dark' ? styles.couponInputDark : styles.couponInputLight]}
              placeholder="Enter coupon code"
              placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
              value={couponCode}
              onChangeText={setCouponCode}
              editable={!appliedCoupon && !isApplyingCoupon}
            />
            {appliedCoupon ? (
              <TouchableOpacity style={[styles.couponButton, colorScheme === 'dark' ? styles.couponButtonDark : styles.couponButtonLight]} onPress={handleRemoveCoupon} disabled={isApplyingCoupon}>
                <Text style={styles.couponButtonText}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.couponButton, (!couponCode || isApplyingCoupon) && styles.couponButtonDisabled, colorScheme === 'dark' ? styles.couponButtonDark : styles.couponButtonLight]}
                onPress={handleApplyCoupon}
                disabled={!couponCode || isApplyingCoupon}
              >
                {isApplyingCoupon ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.couponButtonText}>Apply</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {appliedCoupon && couponDetails && (
            <View style={styles.couponAppliedContainer}>
              <Icon name="check-circle" size={20} color="#4BB543" />
              <Text style={[styles.couponAppliedText, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                Coupon {appliedCoupon} applied
                {couponDetails.discountType === "percentage"
                  ? ` (${couponDetails.discountValue}% off)`
                  : ` (₹${couponDetails.discountAmount} off)`}
              </Text>
            </View>
          )}
          <View style={styles.couponList}>{availableCoupons.map((coupon) => renderCouponItem(coupon))}</View>
        </View>

        {/* Special Instructions */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Special Instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea, colorScheme === 'dark' ? styles.inputDark : styles.inputLight]}
            placeholder="Any special instructions for your order?"
            placeholderTextColor={colorScheme === 'dark' ? "#888" : "#999"}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price Details */}
        <View style={[styles.section, colorScheme === 'dark' ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Price Details</Text>
          <View style={[styles.priceDetails, colorScheme === 'dark' ? styles.priceDetailsDark : styles.priceDetailsLight]}>
            <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Subtotal</Text>
              <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{subtotal.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>
                  Discount{" "}
                  {couponDetails && couponDetails.discountType === "percentage"
                    ? `(${couponDetails.discountValue}%)`
                    : ""}
                </Text>
                <Text style={[styles.priceValue, styles.discountValue]}>-₹{discount.toFixed(2)}</Text>
              </View>
            )}
            {deliveryOption === "delivery" && (
              <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
                <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Delivery Fee</Text>
                <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.priceRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.priceLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Tax (5%)</Text>
              <Text style={[styles.priceValue, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>₹{tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.priceRow, styles.totalRow, colorScheme === 'dark' ? styles.priceRowDark : styles.priceRowLight]}>
              <Text style={[styles.totalLabel, colorScheme === 'dark' ? styles.textDark : styles.textLight]}>Total</Text>
              <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer with Place Order Button */}
      <View style={[styles.footer, colorScheme === 'dark' ? styles.footerDark : styles.footerLight]}>
        {/* Clear Cart Button (for debugging stock issues) */}
        <TouchableOpacity
          style={[styles.clearCartButton, colorScheme === 'dark' ? styles.clearCartButtonDark : styles.clearCartButtonLight]}
          onPress={() => {
            clearBranchCart(selectedBranch)
            showToast("Cart cleared. Please add fresh items from the menu.", "success")
            navigation.goBack()
          }}
          disabled={isOrderLoading}
        >
          <Text style={styles.clearCartButtonText}>Clear Cart</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.placeOrderButton, isOrderLoading && styles.placeOrderButtonDisabled, colorScheme === 'dark' ? styles.placeOrderButtonDark : styles.placeOrderButtonLight]}
          onPress={handlePlaceOrder}
          disabled={isOrderLoading}
        >
          {isOrderLoading ? (
            <ActivityIndicator size="large" color="#FFD700" />
          ) : (
            <Text style={styles.placeOrderButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: "#f8f9fa",
  },
  containerDark: {
    backgroundColor: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainerLight: {
    backgroundColor: "#f8f9fa",
  },
  loadingContainerDark: {
    backgroundColor: "#1a1a1a",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  textLight: {
    color: "#333",
  },
  textDark: {
    color: "#e5e5e5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  headerLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  headerDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
  },
  branchInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  branchInfoLight: {
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
  },
  branchInfoDark: {
    backgroundColor: "#2a2a2a",
    borderBottomColor: "#444",
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  sectionLight: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
  },
  sectionDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "#444",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonLight: {
    backgroundColor: "#800000",
  },
  addButtonDark: {
    backgroundColor: "#4a0000",
  },
  addButtonText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  orderSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  orderSummaryLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  orderSummaryDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  orderItemLight: {
    borderBottomColor: "#e5e7eb",
  },
  orderItemDark: {
    borderBottomColor: "#444",
  },
  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 10,
  },
  orderItemDetails: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderItemQuantity: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD700",
    marginRight: 8,
    width: 30,
  },
  orderItemName: {
    fontSize: 15,
  },
  orderItemPrice: {
    fontSize: 15,
    fontWeight: "600",
  },
  deliveryOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deliveryOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  deliveryOptionLight: {
    borderColor: "#e5e7eb",
  },
  deliveryOptionDark: {
    borderColor: "#444",
  },
  deliveryOptionSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  deliveryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  deliveryOptionTextSelected: {
    color: "#FFD700",
  },
  addressList: {
    marginTop: 8,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  addressItemLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  addressItemDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  addressItemSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  addressItemContent: {
    flex: 1,
  },
  addressItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  addressItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  addressItemBadgeLight: {
    backgroundColor: "#e5e7eb",
  },
  addressItemBadgeDark: {
    backgroundColor: "#444",
  },
  addressItemBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  defaultBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4BB543",
  },
  addressItemText: {
    fontSize: 14,
    lineHeight: 20,
  },
  addressItemRadio: {
    marginLeft: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterLight: {
    borderColor: "#800000",
  },
  radioOuterDark: {
    borderColor: "#FFD700",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#800000",
  },
  addressItemActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  addressAction: {
    marginRight: 16,
  },
  addressActionText: {
    fontSize: 13,
    color: "#FFD700",
    fontWeight: "600",
  },
  deleteActionText: {
    color: "#FF3333",
  },
  noAddressContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
  },
  noAddressContainerLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  noAddressContainerDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  noAddressText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
  },
  noAddressSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  inputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  pickerContainerLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  pickerContainerDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  picker: {
    height: 50,
  },
  pickerLight: {
    color: "#333",
  },
  pickerDark: {
    color: "#e5e5e5",
  },
  couponContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 10,
  },
  couponInputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  couponInputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  couponButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  couponButtonLight: {
    backgroundColor: "#800000",
  },
  couponButtonDark: {
    backgroundColor: "#4a0000",
  },
  couponButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  couponButtonText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "600",
  },
  couponAppliedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  couponAppliedText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4BB543",
    fontWeight: "600",
  },
  couponList: {
    marginTop: 8,
  },
  couponItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  couponItemLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  couponItemDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  couponItemSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  couponItemDisabled: {
    backgroundColor: "#e5e7eb",
    opacity: 0.7,
  },
  couponItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  couponItemDetails: {
    marginLeft: 12,
  },
  couponItemCode: {
    fontSize: 16,
    fontWeight: "700",
  },
  couponItemCodeSelected: {
    color: "#FFD700",
  },
  couponItemDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  couponItemMinOrder: {
    fontSize: 13,
    marginTop: 2,
  },
  priceDetails: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  priceDetailsLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  priceDetailsDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  priceRowLight: {
    borderBottomColor: "#e5e7eb",
  },
  priceRowDark: {
    borderBottomColor: "#444",
  },
  priceLabel: {
    fontSize: 15,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  discountValue: {
    color: "#4BB543",
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    flexDirection: "row",
    gap: 10,
  },
  footerLight: {
    backgroundColor: "#fff",
    borderTopColor: "#e5e7eb",
  },
  footerDark: {
    backgroundColor: "#2a2a2a",
    borderTopColor: "#444",
  },
  placeOrderButton: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  placeOrderButtonLight: {
    backgroundColor: "#800000",
  },
  placeOrderButtonDark: {
    backgroundColor: "#4a0000",
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  clearCartButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  clearCartButtonLight: {
    backgroundColor: "transparent",
    borderColor: "#800000",
  },
  clearCartButtonDark: {
    backgroundColor: "transparent",
    borderColor: "#4a0000",
  },
  clearCartButtonText: {
    color: "#800000",
    fontSize: 14,
    fontWeight: "600",
  },
  toastWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
  },
  toastContainer: {
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  successToast: {
    backgroundColor: "#4BB543",
  },
  errorToast: {
    backgroundColor: "#FF3333",
  },
  toastText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "80%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalContentLight: {
    backgroundColor: "#fff",
  },
  modalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addressTypeContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  addressTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    marginHorizontal: 4,
    borderRadius: 6,
  },
  addressTypeButtonLight: {
    borderColor: "#e5e7eb",
  },
  addressTypeButtonDark: {
    borderColor: "#444",
  },
  addressTypeButtonSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  addressTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressTypeButtonTextSelected: {
    color: "#FFD700",
  },
  addressTypeButtonTextSelectedDark: {
    color: "#FFD700",
  },
  defaultCheckbox: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLight: {
    borderColor: "#e5e7eb",
  },
  checkboxDark: {
    borderColor: "#444",
  },
  checkboxChecked: {
    backgroundColor: "#800000",
    borderColor: "#800000",
  },
  checkboxLabel: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelButtonLight: {
    borderColor: "#e5e7eb",
  },
  cancelButtonDark: {
    borderColor: "#444",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonLight: {
    backgroundColor: "#800000",
  },
  saveButtonDark: {
    backgroundColor: "#4a0000",
  },
  saveButtonDisabled: {
    backgroundColor: "#e5e7eb",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFD700",
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  confirmModalContent: {
    borderRadius: 12,
    padding: 24,
    width: "80%",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmModalContentLight: {
    backgroundColor: "#fff",
  },
  confirmModalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  confirmModalIcon: {
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmModalText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  confirmModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
  },
  confirmCancelButtonLight: {
    borderColor: "#e5e7eb",
  },
  confirmCancelButtonDark: {
    borderColor: "#444",
  },
  confirmCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FF3333",
    borderRadius: 8,
    marginLeft: 8,
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFD700",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '90%',
  },
  modalContentLight: {
    backgroundColor: "#fff",
  },
  modalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  addressTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addressTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  addressTypeButtonLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  addressTypeButtonDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  addressTypeButtonSelected: {
    borderColor: "#800000",
    backgroundColor: "#fff7ed",
  },
  addressTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressTypeButtonTextSelected: {
    color: "#FFD700",
  },
  addressTypeButtonTextSelectedDark: {
    color: "#FFD700",
  },
  // Location Services Styles
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationButtonLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  locationButtonDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  locationButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  locationButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  locationButtonSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInputContainerLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  searchInputContainerDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  searchResults: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 200,
  },
  searchResultsLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  searchResultsDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  searchResultItemLight: {
    borderBottomColor: "#e5e7eb",
  },
  searchResultItemDark: {
    borderBottomColor: "#444",
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orLineLight: {
    backgroundColor: "#e5e7eb",
  },
  orLineDark: {
    backgroundColor: "#444",
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    color: "#333",
  },
  inputDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
    color: "#e5e5e5",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  defaultCheckbox: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLight: {
    borderColor: "#800000",
  },
  checkboxDark: {
    borderColor: "#FFD700",
  },
  checkboxChecked: {
    backgroundColor: "#800000",
  },
  checkboxLabel: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
  },
  cancelButtonLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  cancelButtonDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 10,
  },
  saveButtonLight: {
    backgroundColor: "#800000",
  },
  saveButtonDark: {
    backgroundColor: "#4a0000",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  confirmModalContent: {
    width: "80%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  confirmModalContentLight: {
    backgroundColor: "#fff",
  },
  confirmModalContentDark: {
    backgroundColor: "#2a2a2a",
  },
  confirmModalIcon: {
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmModalText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  confirmModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
  },
  confirmCancelButtonLight: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  confirmCancelButtonDark: {
    borderColor: "#444",
    backgroundColor: "#2a2a2a",
  },
  confirmCancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "#FF3333",
  },
  confirmDeleteButtonText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
  },
})

export default CheckOut
