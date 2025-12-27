
export interface CityResult {
    id: number
    name: string
    latitude: number
    longitude: number
    country?: string
    admin1?: string
}

export async function searchCities(query: string): Promise<CityResult[]> {
    if (query.length < 2) return []

    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                query
            )}&count=5&language=en&format=json`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch cities')
        }

        const data = await response.json()

        if (!data.results) {
            return []
        }

        return data.results.map((item: any) => ({
            id: item.id,
            name: item.name,
            latitude: item.latitude,
            longitude: item.longitude,
            country: item.country,
            admin1: item.admin1,
        }))
    } catch (error) {
        console.error('Error searching cities:', error)
        return []
    }
}
