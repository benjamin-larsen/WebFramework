# Introduction

Noctes.jsx is a project of mine I've worked on since about August 18th, 2025. It went from bare boilerplate into a somewhat useful framework, including Components and Directives.

This project has been a true learning expirence, and I've gained massive insight into how Web Frameworks work internally.


# Create a new Noctes.jsx App

To create a new Noctes.jsx App run this in console:
```sh
$ npm create noctes-jsx@latest
```


# How a Noctes.jsx App is structured
Components including Root Containers are made in .jsx files, with a export default object with a render() method, the render function should return a Fragment `<> ... </>` (which is just an Array, you could likewise just return an Array `[ ... ]`).

However when you return an Array (`[ ... ]`) instead of a Fragment (`<> ... </>`), you write Text manually, you can write Fragments and other VNodes like normal tho, Array is comma-seperated like normal arrays.