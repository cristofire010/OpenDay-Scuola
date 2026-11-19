'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Keyboard, LoaderCircle, ScanLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [mode, setMode] = useState<'idle' | 'starting' | 'live' | 'photo'>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
      setMode('photo')
      setCameraError('Il browser concede la fotocamera solo in HTTPS. Usa la foto del QR qui sotto.')
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
      setMode('photo')
      setCameraError(
        name === 'NotAllowedError'
          ? 'Permesso fotocamera negato. Attivalo dalle impostazioni del browser (icona lucchetto) e riprova.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'Nessuna fotocamera disponibile su questo dispositivo.'
            : 'Non riesco ad aprire la fotocamera. Usa la foto del QR qui sotto.',
      )
    }
  }, [finish])

  async function decodePhoto(file: File) {
    setBusy(true)
    setError(null)
    try {
      const decode = await loadDecoder()
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('canvas non disponibile')
      context.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      const pixels = context.getImageData(0, 0, width, height)
      const result = decode(pixels.data, pixels.width, pixels.height)
      if (result?.data) finish(result.data)
      else setError('QR non riconosciuto: inquadralo più da vicino e riprova.')
    } catch {
      setError('Non riesco a leggere la foto. Riprova o scrivi il codice.')
    } finally {
      setBusy(false)
    }
  }

  const photoInput = (
    <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-background/30 px-4 text-base font-bold">
      {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
      {busy ? 'Leggo il codice…' : 'Scatta una foto del QR'}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void decodePhoto(file)
        }}
      />
    </label>
  )

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
              ) : mode === 'photo' ? (
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

        {mode !== 'live' && photoInput}

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
              onChange={(event) => setManual(event.target.value)}
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
