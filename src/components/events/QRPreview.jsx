'use client'
import React, { useRef } from 'react'

import { QRCodeSVG } from 'qrcode.react'
import { Button, Stack } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'

export default function QRPreview({ value, size = 180, fileName = 'evento-qr.png' }) {
  const canvasId = `qr-canvas-${Math.random().toString(36).slice(2)}`
  const ref = useRef(null)

  const handleDownload = () => {
    const canvas = document.getElementById(canvasId)

    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')

    a.href = url
    a.download = fileName
    a.click()
  }

  return (
    <Stack spacing={1} alignItems='center'>
      <QRCodeSVG id={canvasId} value={value || ''} size={size} includeMargin />
      <Button size='small' variant='outlined' startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!value}>
        Baixar QR
      </Button>
    </Stack>
  )
}
