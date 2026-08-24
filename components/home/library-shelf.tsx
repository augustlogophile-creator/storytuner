"use client"

import { useState, type CSSProperties } from "react"
import { Shuffle } from "lucide-react"

const SPINE_COLORS = ["#4E6E8F", "#B26A45", "#6E6047"]

const SHELVES = [
  { label: "Finding material: notice specific moments from your own life that can become strong stories.", books: [
    { title: "Bird by Bird", author: "Anne Lamott" },
    { title: "Storyworthy", author: "Matthew Dicks" },
    { title: "How to Tell a Story", author: "The Moth" },
  ] },
  { label: "Openings: learn how to establish attention, tension, and direction from the first lines.", books: [
    { title: "The First Five Pages", author: "Noah Lukeman" },
    { title: "Wired for Story", author: "Lisa Cron" },
  ] },
  { label: "Endings: learn how to resolve a story clearly without over-explaining the point.", books: [
    { title: "Story", author: "Robert McKee" },
    { title: "Plot & Structure", author: "James Scott Bell" },
    { title: "The Story Grid", author: "Shawn Coyne" },
  ] },
  { label: "Structure and pacing: shape scenes so the story keeps moving and each beat earns the next.", books: [
    { title: "Into the Woods", author: "John Yorke" },
    { title: "The Anatomy of Story", author: "John Truby" },
    { title: "Techniques of the Selling Writer", author: "Dwight V. Swain" },
  ] },
  { label: "Stakes: make clear why the outcome matters and why a listener should care what happens next.", books: [
    { title: "Conflict and Suspense", author: "James Scott Bell" },
    { title: "The Art of Dramatic Writing", author: "Lajos Egri" },
    { title: "Story Genius", author: "Lisa Cron" },
  ] },
  { label: "Voice: develop language and rhythm that still sound natural, specific, and recognizably yours.", books: [
    { title: "On Writing", author: "Stephen King" },
    { title: "Steering the Craft", author: "Ursula K. Le Guin" },
  ] },
  { label: "Oral storytelling: adapt story structure, pacing, and emphasis for speaking to a real audience.", books: [
    { title: "Confessions of a Public Speaker", author: "Scott Berkun" },
    { title: "Talk Like TED", author: "Carmine Gallo" },
    { title: "Resonate", author: "Nancy Duarte" },
  ] },
  { label: "Memoir and ethics: write honestly about your life while handling privacy and other people with care.", books: [
    { title: "The Art of Memoir", author: "Mary Karr" },
    { title: "Handling the Truth", author: "Beth Kephart" },
    { title: "Inventing the Truth", author: "ed. William Zinsser" },
  ] },
  { label: "Story theory: compare different frameworks for structure, meaning, and why stories hold attention.", books: [
    { title: "The Seven Basic Plots", author: "Christopher Booker" },
    { title: "Poetics", author: "Aristotle" },
  ] },
  { label: "Comic timing: study setup, beat, pause, surprise, and payoff in stories that are meant to be funny.", books: [
    { title: "The Comic Toolbox", author: "John Vorhaus" },
    { title: "Poking a Dead Frog", author: "Mike Sacks" },
  ] },
] as const

export function LibraryShelf() {
  const [index, setIndex] = useState(0)
  const [changing, setChanging] = useState(false)
  const [spinKey, setSpinKey] = useState(0)
  const shelf = SHELVES[index]

  function shuffleShelf() {
    if (changing) return
    setSpinKey((value) => value + 1)
    setChanging(true)
    window.setTimeout(() => {
      setIndex((value) => (value + 1) % SHELVES.length)
      setChanging(false)
    }, 145)
  }

  return (
    <section className="home-library" aria-label="Curated storytelling books">
      <div className="home-library-copy">
        <p key={index} className={`home-library-label ${changing ? "is-changing" : ""}`} aria-live="polite">{shelf.label}</p>
        <button type="button" className="home-library-shuffle" onClick={shuffleShelf} aria-label="Show a different book shelf">
          <span key={spinKey}><Shuffle /></span>
        </button>
      </div>

      <div key={`shelf-${index}`} className={`home-library-books is-${shelf.books.length} ${changing ? "is-changing" : ""}`}>
        {shelf.books.map((book, bookIndex) => (
          <LibraryBook
            key={`${index}-${book.title}`}
            title={book.title}
            author={book.author}
            color={SPINE_COLORS[bookIndex % SPINE_COLORS.length]}
            delay={bookIndex * 45}
          />
        ))}
      </div>
    </section>
  )
}

function LibraryBook({ title, author, color, delay }: { title: string; author: string; color: string; delay: number }) {
  return (
    <article className="home-library-book" style={{ "--book-color": color, "--book-delay": `${delay}ms` } as CSSProperties}>
      <div className="home-library-book-pages" aria-hidden="true" />
      <div className="home-library-book-cover">
        <div className="home-library-book-color" />
        <div className="home-library-book-copy">
          <strong>{title}</strong>
          <span>{author}</span>
        </div>
        <div className="home-library-book-spine" aria-hidden="true" />
      </div>
    </article>
  )
}
