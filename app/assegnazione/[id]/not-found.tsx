import Link from 'next/link'
import { ArrowRight, SearchX } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'

export default function AssignmentNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="section-shell flex h-[72px] items-center"><Brand /></div>
      </header>
      <main id="main-content" className="section-shell flex min-h-[70vh] items-center justify-center py-12">
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-giallo text-giallo-foreground">
            <SearchX className="size-7" aria-hidden="true" />
          </span>
          <h1 className="display mt-6 text-3xl">Non troviamo questo biglietto.</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Il link potrebbe essere incompleto. Puoi iscriverti di nuovo oppure chiedere aiuto all’accoglienza.</p>
          <Button nativeButton={false} render={<Link href="/join" />} size="lg" className="mt-7 h-11 rounded-md px-5">
            Nuova iscrizione
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </main>
    </div>
  )
}
