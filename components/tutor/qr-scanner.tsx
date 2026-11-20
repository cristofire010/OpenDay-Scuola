'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Keyboard, LoaderCircle, ScanLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatScanCode } from '@/lib/scan-codes'

type JsQrResult = { data: string } | null
type JsQrFn = (data: Uint8ClampedArray, width: number, height: number) => JsQrResult
type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

declare global {
  interface Window {
    jsQR?: JsQrFn
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

let decoderPromise: Promise<JsQrFn> | null = null

/** Il decoder arriva da /vendor/jsqr.js: nessuna dipendenza a runtime, funziona anche offline. */
function loadDecoder() {
  if (window.jsQR) return Promise.resolve(window.jsQR)
  if (!decoderPromise) {
    decoderPromise = new Promise<JsQrFn>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/vendor/jsqr.js'
      script.async = true
      script.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('decoder non disponibile')))
      script.onerror = () => reject(new Error('decoder non disponibile'))
      document.head.appendChild(script)
    })
  }
  return decoderPromise
}

const FRAME_WIDTH = 640

export function QrScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const foundRef = useRef(false)
  const [mode, setMode] = useState<'idle' | 'starting' | 'live' | 'unavailable'>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const finish = useCallback(
    (value: string) => {
      if (foundRef.current) return
      foundRef.current = true
      stopCamera()
      onDetected(value)
    },
    [onDetected, stopCamera],
  )

  /** Deve partire da un tocco: iOS rifiuta la fotocamera se la chiediamo da soli. */
  const startCamera = useCallback(async () => {
    setCameraError(null)
    setError(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMode('unavailable')
      setCameraError('Fotocamera non disponibile. Inserisci il codice manualmente qui sotto.')
      return
    }

    setMode('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        await video.play().catch(() => undefined)
      }
      setMode('live')

      const Detector = window.BarcodeDetector
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
      const decode = detector ? null : await loadDecoder()
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      let analysing = false

      timerRef.current = window.setInterval(async () => {
        const element = videoRef.current
        if (!element || element.readyState < 2 || analysing || foundRef.current) return

        analysing = true
        try {
          if (detector) {
            const codes = await detector.detect(element)
            const value = codes[0]?.rawValue
            if (value) finish(value)
          } else if (decode && context) {
            const sourceWidth = element.videoWidth
            const sourceHeight = element.videoHeight
            if (sourceWidth === 0 || sourceHeight === 0) return
            const scale = Math.min(1, FRAME_WIDTH / Math.max(sourceWidth, sourceHeight))
            canvas.width = Math.max(1, Math.round(sourceWidth * scale))
            canvas.height = Math.max(1, Math.round(sourceHeight * scale))
            context.drawImage(element, 0, 0, canvas.width, canvas.height)
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
            const result = decode(pixels.data, pixels.width, pixels.height)
            if (result?.data) finish(result.data)
          }
        } catch {
          // Fotogramma non leggibile: si riprova al giro dopo.
        } finally {
          analysing = false
        }
      }, 300)
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : ''
      setMode('unavailable')
      setCameraError(
        name === 'NotAllowedError'
          ? 'Accesso alla fotocamera negato. Inserisci il codice manualmente qui sotto.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'Nessuna fotocamera disponibile. Inserisci il codice manualmente qui sotto.'
            : 'Non riesco ad aprire la fotocamera. Inserisci il codice manualmente qui sotto.',
      )
    }
  }, [finish])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground text-background" role="dialog" aria-modal="true" aria-label="Scansiona il QR del biglietto">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <p className="display-sm flex items-center gap-2 text-xl">
          <ScanLine className="size-5" aria-hidden="true" />
          Scansiona il QR
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            stopCamera()
            onClose()
          }}
          className="h-10 rounded-md text-background hover:bg-background/15 hover:text-background"
        >
          <X aria-hidden="true" />
          Chiudi
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-background/30 bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />

          {mode === 'live' && (
            <>
              <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-giallo" aria-hidden="true" />
              <p className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-sm">
                Inquadra il QR del biglietto dentro il riquadro
              </p>
            </>
          )}

          {mode !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground/95 p-5 text-center">
              {mode === 'starting' ? (
                <>
                  <LoaderCircle className="size-8 animate-spin text-giallo" aria-hidden="true" />
                  <p className="text-base font-bold">Apro la fotocamera…</p>
                </>
              ) : mode === 'unavailable' ? (
                <>
                  <span className="flex size-14 items-center justify-center rounded-full bg-giallo text-giallo-foreground">
                    <CameraOff className="size-6" aria-hidden="true" />
                  </span>
                  <p className="text-base font-bold">Fotocamera non disponibile</p>
                  <p className="text-sm leading-snug text-background/80">{cameraError}</p>
                </>
              ) : (
                <>
                  <span className="flex size-14 items-center justify-center rounded-full bg-giallo text-giallo-foreground">
                    <Camera className="size-6" aria-hidden="true" />
                  </span>
                  <p className="text-base font-bold">Inquadra il QR del biglietto</p>
                  <p className="text-sm leading-snug text-background/80">
                    La lettura avviene qui nel sito, la foto non viene inviata da nessuna parte.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void startCamera()}
                    className="h-12 w-full rounded-md bg-giallo px-5 text-base font-bold text-giallo-foreground"
                  >
                    <Camera aria-hidden="true" />
                    Attiva la fotocamera
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="w-full max-w-md rounded-lg bg-destructive/20 px-4 py-3 text-base">
            {error}
          </p>
        )}

        <form
          className="w-full max-w-md"
          onSubmit={(event) => {
            event.preventDefault()
            if (manual.trim()) {
              stopCamera()
              onDetected(manual.trim())
            }
          }}
        >
          <label htmlFor="scan-code" className="flex items-center gap-2 text-sm font-bold text-background/80">
            <Keyboard className="size-4" aria-hidden="true" />
            Oppure scrivi il codice
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="scan-code"
              value={manual}
              onChange={(event) => {
                const value = event.target.value
                const code = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
                setManual(code.length > 8 ? value : code.length > 4 ? formatScanCode(code) : code)
              }}
              placeholder="K7M2-P9QX"
              autoComplete="off"
              autoCapitalize="characters"
              className="h-12 rounded-md border-background/30 bg-background/10 px-4 text-base tracking-widest text-background placeholder:text-background/40"
            />
            <Button type="submit" className="h-12 shrink-0 rounded-md px-5 text-base font-bold">
              Cerca
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
