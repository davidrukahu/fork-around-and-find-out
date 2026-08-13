# Fork Around & Find Out

![Fork Around & Find Out social card](social-card.png)

A fast browser-game satire about keeping a fictional open-source Commons alive while bugs, invoices, commercial pressure, and tiny parachuting lawyers pull it in different directions.

Everything in the game is fictional. It does not reenact a lawsuit or make claims about real companies or people.

**Play:** [davidrukahu.github.io/fork-around-and-find-out](https://davidrukahu.github.io/fork-around-and-find-out/)

**Source:** [github.com/davidrukahu/fork-around-and-find-out](https://github.com/davidrukahu/fork-around-and-find-out)

## Play

Open `index.html` directly, or serve the directory locally:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Controls

- Move the blue Commons tray with the mouse, touch, arrow keys, or A/D.
- Catch green-framed work.
- Avoid red-framed hazards.
- Grab flashing gold power-ups.
- Press R when the yellow reinvestment button says READY.
- Press P or Esc to pause, resume, or exit to the title screen.

The full game takes about three to five minutes and requires no login.

## Technology

The game has no build step and no external runtime dependencies. It uses HTML, CSS, Canvas, vanilla JavaScript, and the Web Audio API. It does not include analytics or tracking.

## Publish with GitHub Pages

1. Create a repository and place these files at its root.
2. Push the default branch to GitHub.
3. In **Settings → Pages**, publish from the root of the default branch.
4. When the public URL is known, add it as the canonical URL and use its absolute `social-card.png` URL in the Open Graph metadata.
5. Test the public URL on desktop and mobile before announcing it.

## Publish on itch.io

Upload `fork-around-and-find-out-itch.zip` as an **HTML Game**. The archive places `index.html` at its root, as itch.io requires. Enable **Mobile Friendly** and use **Click to launch in fullscreen**.

## Contributing

Small fixes, accessibility improvements, new fictional events, and well-balanced satire are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Credits

Created collaboratively with OpenAI Codex. The visual system, characters, code, and copy are original to this project.

## Licence

Released under the [MIT Licence](LICENSE).
