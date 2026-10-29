import api from 'lib/api'

export function apiErrorDetail(data) {
	const detail = data?.detail
	if (typeof detail === 'string') return detail
	if (Array.isArray(detail)) return detail.map((item) => String(item)).join(', ')
	if (detail && typeof detail === 'object') {
		return Object.entries(detail)
			.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
			.join('; ')
	}
	return ''
}

const RESERVED_SLUGS = new Set([
	'video',
	'event',
	'events',
	'api',
	'static',
	'default',
	'common',
	'orga',
	'control',
	'admin',
	'undefined',
	'null'
])

function isValidSlug(val) {
	return typeof val === 'string' && val.trim().length > 0 && !RESERVED_SLUGS.has(val.trim().toLowerCase())
}

export function interpretationRouting(store) {
	const world = store?.state?.world || store?.world
	let organizer = world?.organizer_slug
	let event = world?.slug || world?.id

	if (isValidSlug(organizer) && isValidSlug(event)) {
		return { organizer: organizer.trim(), event: String(event).trim() }
	}

	if (typeof window !== 'undefined') {
		const injected = window.eventyay || window.venueless
		if (!isValidSlug(organizer)) {
			organizer = injected?.organizerSlug || injected?.organizer_slug
		}
		if (!isValidSlug(event)) {
			event = injected?.eventSlug || injected?.event_slug
		}

		// Check injected URLs (e.g., videoUrl, interpretationUrl, ticketUrl, basePath)
		if (!isValidSlug(organizer) || !isValidSlug(event)) {
			const candidateUrls = [
				injected?.basePath,
				injected?.videoUrl,
				injected?.interpretationUrl,
				injected?.ticketUrl,
				injected?.talkUrl,
				injected?.homeUrl,
				injected?.publicVideoUrl
			].filter(Boolean)

			for (const u of candidateUrls) {
				if (isValidSlug(organizer) && isValidSlug(event)) break
				const parts = String(u).split('/').filter(Boolean)
				if (parts[0] === 'video' && parts[1] === 'event' && parts.length >= 4) {
					if (!isValidSlug(organizer)) organizer = parts[2]
					if (!isValidSlug(event)) event = parts[3]
				} else if (parts[0] === 'video' && parts[1] === 'plugins' && parts.length >= 4) {
					if (!isValidSlug(organizer)) organizer = parts[2]
					if (!isValidSlug(event)) event = parts[3]
				} else if (parts[1] === 'event' && parts.length >= 4) {
					if (!isValidSlug(organizer)) organizer = parts[2]
					if (!isValidSlug(event)) event = parts[3]
				} else if (parts.length >= 3 && parts[2] === 'video') {
					if (!isValidSlug(organizer)) organizer = parts[0]
					if (!isValidSlug(event)) event = parts[1]
				}
			}
		}

		// Fallback to window.location.pathname parsing
		if (!isValidSlug(organizer) || !isValidSlug(event)) {
			const pathParts = window.location.pathname.split('/').filter(Boolean)
			// Shape 1: /video/event/:organizer/:event/...
			if (pathParts[0] === 'video' && pathParts[1] === 'event' && pathParts.length >= 4) {
				if (!isValidSlug(organizer)) organizer = pathParts[2]
				if (!isValidSlug(event)) event = pathParts[3]
			}
			// Shape 2: /:organizer/:event/video/...
			else if (pathParts.length >= 3 && pathParts[2] === 'video') {
				if (!isValidSlug(organizer)) organizer = pathParts[0]
				if (!isValidSlug(event)) event = pathParts[1]
			}
			// Shape 3: /control/event/:organizer/:event/... or /orga/event/:organizer/:event/...
			else if (pathParts[1] === 'event' && pathParts.length >= 4) {
				if (!isValidSlug(organizer)) organizer = pathParts[2]
				if (!isValidSlug(event)) event = pathParts[3]
			}
			// Shape 4: Generic /:organizer/:event/... (ensure neither is a reserved keyword)
			else if (pathParts.length >= 2 && isValidSlug(pathParts[0]) && isValidSlug(pathParts[1])) {
				if (!isValidSlug(organizer)) organizer = pathParts[0]
				if (!isValidSlug(event)) event = pathParts[1]
			}
		}
	}

	return {
		organizer: isValidSlug(organizer) ? organizer.trim() : null,
		event: isValidSlug(event) ? String(event).trim() : null,
	}
}

export function interpretationApiUrl(store, roomId, suffix = 'config/') {
	const { organizer, event } = interpretationRouting(store)
	if (!organizer || !event || !roomId) {
		return null
	}
	return `/api/v1/organizers/${organizer}/events/${event}/rooms/${roomId}/interpretation/${suffix}`
}

export async function interpretationAuthHeaders(json = false) {
	let authHeader = null
	if (api?._config?.token) {
		authHeader = `Bearer ${api._config.token}`
	} else if (api?._config?.clientId) {
		authHeader = `Client ${api._config.clientId}`
	}
	const headers = { Accept: 'application/json' }
	if (json) headers['Content-Type'] = 'application/json'
	if (authHeader) headers.Authorization = authHeader
	if (json && typeof document !== 'undefined') {
		const match = document.cookie.match(/eventyay_csrftoken=([^;]+)/)
		if (match) headers['X-CSRFToken'] = match[1]
	}
	return headers
}
