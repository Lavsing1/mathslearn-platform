# Mathematics Lecture Studio

A teaching app for maths: lectures, books, MCQ quizzes, PDF export, built-in PDF reader.
No server, no accounts. Everything is plain HTML, CSS and JavaScript.

## Folder layout (keep it exactly like this)

```
index.html              the page itself (very small)
build.py                makes one single file out of everything (optional)
Mathematics-Lecture-Studio.html   ready-made single file (made by build.py)

css/
  home.css              HOME SCREEN look: colours, cards, tiles   <- edit to restyle the home page
  app.css               editor, presenter, books, quizzes, dialogs
  katex.css             maths fonts (vendor file, do not edit)

js/                     loaded in this order (see index.html)
  01-core.js            helpers, storage, maths rendering, lecture model, undo/redo
  02-editor.js          editor screen, text formatting, diagrams, settings, all button actions ("acts")
  03-presenter.js       presenter (Next / page mode) and presenter pencils
  04-extras.js          templates, proof patterns, share page, help, formula auto-complete
  05-files.js           save into a chosen file, PDF export, PDF reader
  06-books.js           books: chapters, sections, contents
  07-quiz.js            MCQ quizzes: editor, live session, student page, sounds
  08-home.js            HOME SCREEN: search, tabs, cards        <- edit to change the home page
  09-start.js           keyboard shortcuts and start-up (always last)

lib/                    third-party libraries (do not edit)
  katex.min.js  pdf-lib.min.js  pdfjs.src.js  pdfjs-worker.src.js
```

## Two ways to run it

1. **From a web address (GitHub Pages, any web host).** Upload the whole folder. Everything works,
   including PDF export and share pages.
2. **Single file, offline.** Run `python3 build.py` (no packages needed). It writes
   `Mathematics-Lecture-Studio.html`, one file you can double-click, email or put on a pen drive.

Why not just double-click `index.html`? Browsers do not let a page read its own style files when it is
opened straight from a folder. The app still runs, but PDF export and share pages show a message asking
you to use the web address or the single file.

## How to change things

| I want to change... | Edit this file |
|---|---|
| Home page look (colours, cards, tiles) | `css/home.css` |
| Home page content (what is shown, buttons, search) | `js/08-home.js` |
| Editor, presenter, dialogs look | `css/app.css` |
| A button action (every button is `data-act="name"` and lives in the `acts` object) | `js/02-editor.js` (and `acts.something = ...` in other files) |
| Lecture templates, proof patterns, help text | `js/04-extras.js` |
| Books | `js/06-books.js` |
| Quizzes, sounds, student page | `js/07-quiz.js` |

After editing, reload the page. If you use the single file, run `python3 build.py` again.

Rule of thumb: all files share one global scope (no modules), loaded in the order in `index.html`.
A function in one file can call a function in another file, as long as it is called after start-up.

## Your data

Lectures, books and quizzes are saved in the browser (localStorage, about 5 MB).
Use **Export everything** on the home screen (or *Auto-save everything into a file*) to keep a backup.
Replacing these app files never deletes your data.

## Libraries and licences

KaTeX (MIT), pdf.js (Apache 2.0), pdf-lib (MIT). Their licence notices are inside the files in `lib/`.
