import { config } from '../config/env.js'
import { renderStatusPage } from '../views/status-page.js'

const formatUptime = (seconds) => {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }

  return `${secs}s`
}

export const getHealth = (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'jewellery-backend',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      port: config.port,
    },
  })
}

export const getStatusPage = (_req, res) => {
  const html = renderStatusPage({
    appName: 'Jewellery Management Backend',
    status: 'Healthy',
    apiPath: '/api/v1/health',
    uptime: formatUptime(process.uptime()),
    timestamp: new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }),
  })

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(html)
}
