# Amazon EcoPack
We love online shopping, but every package carries a hidden environmental cost!

- 📦 Half-Empty Boxes: Trucks filled with more air than products.
- 🌳 Wasted Resources: Unnecessary packaging material.
- 💨 Carbon Emissions: More boxes = more weight, more trips, more CO2.

Millions of packages, every day, contributing to this waste. 
It's a massive but solvable problem!

## Motivation
The inspiration for EcoPack stemmed from a growing awareness of the environmental footprint of everyday online shopping. I, like many, frequently use platforms like Amazon for convenience. However, I started noticing a recurring issue: packages often arrived with more empty space than product, leading to excessive packaging waste and unnecessary carbon emissions. This "hidden cost of convenience" resonated deeply with me.

I understood that Amazon already offers initiatives like later-day delivery to encourage lower carbon emissions by consolidating shipments. My vision was to build upon this by providing users with real-time, granular insights into the sustainability of their current order's packaging. I wanted to empower users to make more informed decisions right at the cart level, not just at checkout, by showing them the direct impact of their choices on packaging efficiency and CO₂.

Delving into packing algorithms was fascinating. I learned about the complexities of optimizing for volume and weight, and the trade-offs involved in greedy versus more exhaustive approaches. The challenge wasn't just to fit items, but to fit them efficiently to reduce overall packaging and carbon emissions.

## Core Logic - The Packing Algorithm:

I defined standard Amazon box sizes with their dimensions, max weights, and estimated CO₂ impact per box and per kilogram.

The heart of the application is my packOptimal algorithm. It first attempts to fit all items into the smallest single box possible. If that's not feasible, it switches to a greedy multi-package heuristic. This heuristic prioritizes filling existing boxes as much as possible before opening a new, smallest suitable box.

The calculateMetrics function then takes the packed boxes and computes key sustainability indicators: packaging efficiency, total estimated CO₂ impact, and CO₂ saved by consolidation.

## User Interface Development:

The main layout is a responsive grid divided into three primary sections:

- Find Products: A search bar and a list of predefined items (Book, Laptop, Mug, etc.) that users can add to their cart. I refined this to be a compact, list-like display without large icons to save space.

- Your Cart & Saved for Later: Two distinct sections for managing items. Users can adjust quantities, remove items, or move them between the cart and a "Saved for Later" list. This "Saved for Later" feature is a core part of EcoPack's sustainability strategy. It intelligently analyzes the empty space within the boxes already allocated for your current order. If items from your "Saved for Later" list can fit into this existing unused space – without requiring any new boxes or a larger box size – EcoPack suggests adding them. This directly helps users maximize packaging utilization and significantly reduce the overall environmental impact by avoiding additional shipments or unnecessary packaging.

- Optimal Shipment Plan & Bulk Order Suggestion: This section dynamically displays the calculated packing efficiency, CO₂ impact, and suggests items from the "Saved for Later" list that, if added to the current order, could further reduce CO₂ emissions without requiring an additional box.