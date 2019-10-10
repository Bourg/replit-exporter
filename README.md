repl.it exporter
================

This is a super hacky first version of a Selenium-driven export tool for repl.it. It isn't yet configurable or designed to gracefully handler errors or much of anything really, just a barebones first pass at getting student code out of a repl.it classroom in one specific case.

Authentication
--------------

In order for authentication to work, create a `credentials.toml` file with the following format:

```
username = "person@website.com"
password = "password123"
```
