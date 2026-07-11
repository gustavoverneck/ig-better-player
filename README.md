# IG Better Player

IG Better Player is a browser extension that adds improved video controls to Instagram Web.

The extension adds a custom floating player interface with:

* Video progress bar
* Time control / seeking
* Volume control
* Mute / unmute button
* Playback speed selector
* Keyboard shortcuts
* YouTube-style hover controls

## Purpose

Instagram frequently changes or removes parts of its native video player interface, such as volume and timeline controls. This extension adds an independent control layer on top of Instagram videos so users can have a more consistent playback experience.

## Features

* Custom video progress bar
* Custom volume slider
* Shows current time and total video duration
* Remembers preferred volume
* Reapplies volume settings when scrolling through Reels
* Playback speed control
* Keyboard shortcuts:

  * `Space`: play / pause
  * `←`: rewind
  * `→`: forward
  * `↑`: increase volume
  * `↓`: decrease volume
  * `M`: mute / unmute

## Installation for Development

1. Download or clone this repository.

2. Open Chrome and go to:

   `chrome://extensions`

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the project folder.

6. Open Instagram Web and test the extension.

## Project Structure

```text
ig-better-player/
  manifest.json
  content.js
  styles.css
  options.html
  options.js
  icons/
    icon128.png
```

## AI Usage Disclosure

This project was created with assistance from AI tools.

AI was used to help with:

* Planning the browser extension architecture
* Writing the initial JavaScript, CSS, and Manifest V3 code
* Debugging issues related to Instagram video behavior
* Designing the extension logo concept
* Drafting this README

The code was reviewed, tested, and adapted during development. AI-generated output should not be assumed to be perfect or production-ready without human review.

## Disclaimer

This extension is an independent project and is not affiliated with, endorsed by, or sponsored by Instagram, Meta, Facebook, or any related company.

Instagram may change its website behavior at any time, which can break some extension features.

