"use client"

import FuzzyCritterFooter from "./componentfooter"

export default function FuzzyCritterFooterDemo() {
    return (
        <div className="w-full bg-background text-foreground">
            <section className="grid min-h-[100svh] place-content-center justify-items-center gap-2.5 text-[15px] text-muted-foreground">
                <p>Scroll down</p>
                <span aria-hidden="true" className="text-xl motion-safe:animate-bounce">↓</span>
            </section>
            <FuzzyCritterFooter wordmark="Makers Need More" name="Makers Need More" copyright="© 2026 Makers Need More" />
        </div>
    )
}
