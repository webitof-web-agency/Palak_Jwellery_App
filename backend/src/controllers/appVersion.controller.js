import { Readable } from 'node:stream'
import { config } from '../config/env.js'

const releaseApiUrl = () =>
  `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/releases/latest`

const githubHeaders = (accept) => {
  const headers = { Accept: accept, 'User-Agent': 'palak-jewellers-backend' }
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`
  }
  return headers
}

const fetchLatestRelease = async () => {
  const response = await fetch(releaseApiUrl(), {
    headers: githubHeaders('application/vnd.github+json'),
  })

  if (!response.ok) {
    const message =
      response.status === 404
        ? 'No releases found, or the repo is private and GITHUB_TOKEN is missing/invalid'
        : `GitHub responded with ${response.status}`
    throw Object.assign(new Error(message), { status: 502 })
  }

  const body = await response.json()
  const apkAsset = (body.assets || []).find((asset) =>
    (asset.name || '').toLowerCase().endsWith('.apk')
  )

  if (!apkAsset) {
    throw Object.assign(new Error('Latest release does not have an APK attached'), { status: 502 })
  }

  return { body, apkAsset }
}

export const getLatestVersion = async (req, res) => {
  try {
    const { body, apkAsset } = await fetchLatestRelease()
    const tagName = body.tag_name || ''
    const version = tagName.startsWith('v') ? tagName.slice(1) : tagName

    return res.status(200).json({
      success: true,
      data: {
        version,
        releaseNotes: (body.body || '').trim(),
        apkSizeBytes: apkAsset.size || 0,
        downloadUrl: `${req.protocol}://${req.get('host')}/download`,
      },
    })
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to check for updates',
      code: 'APP_VERSION_CHECK_FAILED',
    })
  }
}

export const downloadLatestApk = async (req, res) => {
  try {
    const { apkAsset } = await fetchLatestRelease()

    const assetResponse = await fetch(apkAsset.url, {
      headers: githubHeaders('application/octet-stream'),
      redirect: 'follow',
    })

    if (!assetResponse.ok || !assetResponse.body) {
      throw Object.assign(new Error(`Failed to fetch APK asset (${assetResponse.status})`), {
        status: 502,
      })
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive')
    res.setHeader('Content-Disposition', `attachment; filename="${apkAsset.name}"`)
    if (apkAsset.size) {
      res.setHeader('Content-Length', String(apkAsset.size))
    }

    Readable.fromWeb(assetResponse.body).pipe(res)
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to download update',
        code: 'APP_VERSION_DOWNLOAD_FAILED',
      })
    } else {
      res.destroy(error)
    }
  }
}
