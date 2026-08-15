# Food Delivery Platform

A full-stack food ordering application built as an end-to-end solution for a modern food delivery experience. It covers product browsing (with customization and coupon application), cart and order management, user profile and address management, payment processing using Razorpay, and an **admin panel** for managing orders, products, and more.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Admin Panel](#admin-panel)
- [Technology Stack](#technology-stack)

## Overview

This project simulates a modern food ordering app where users can browse food items, customize them, add them to a cart, and check out using either cash-on-delivery or online payment via Razorpay. It also includes user profile and address management, coupon application, and a delivery zone check to validate serviceability. An **admin panel** provides tools for managing products, orders, coupons, and more.

## Features

- **Product Browsing & Customization:**

  - Browse food items by menu or category.
  - Customize items with various add-ons/options.

- **Cart & Order Management:**

  - Add, update, and remove items from the cart.
  - Place orders with an integrated checkout flow.
  - View detailed order summaries and status.

- **Payment Integration:**

  - Integrated with Razorpay for secure online payments.
  - Supports both online payment and cash-on-delivery.

- **User Profile & Address Management:**

  - Manage user profile details.
  - List and add delivery addresses, with delivery zone validation.

- **Coupon Support:**

  - Apply discount coupons during checkout.

- **Modern UI:**
  - Responsive design built using Tailwind CSS and Mantine components.

## Admin Panel

The platform includes an **admin dashboard** that provides essential features for managing the entire food delivery operation:

- **Dashboard Overview:**

  - Quick statistics on revenue, total orders, active users, and average order value.
  - Visual charts (e.g., line or bar charts) to track revenue and orders over time.

- **Products & Customizations:**

  - Create, update, and delete products.
  - Manage product categories and associated customization groups/options.

- **Order Management:**

  - View all orders with status, payment type, and total amount.
  - Update order statuses (e.g., pending, shipped, delivered).
  - Access detailed order pages, including items, customizations, and assigned coupons.

- **Coupons & Discounts:**

  - Create and manage discount coupons.
  - Set expiration dates, discount amounts, and usage rules.

- **Menu & Organization:**

  - Control which products are active/inactive.
  - Organize products into menus for easy user browsing.

- **Analytics & Reports:**

  - Time-series charts for revenue, orders, and user activity.
  - Compare current vs. previous periods for key metrics.

- **User & Address Data (Optional):**

  - Admins can view user profiles and addresses if needed for support or auditing.

- **Secure Access:**
  - Admin routes protected with role-based checks or token-based auth.

## Technology Stack

- **Frontend:**

  - **React** for building the user and admin interfaces.
  - **TanStack Query** for data fetching and caching.
  - **Zustand** for lightweight state management (e.g., date range pickers, global modals).
  - **Mantine & Tailwind CSS** for UI components and styling (responsive design, theme-based styling).

- **Backend:**

  - **Node.js & Express** for server logic and routing.
  - **Drizzle ORM** with **PostgreSQL** for database queries and schema management.
  - **Zod** for schema validation and data parsing.
  - **Razorpay** integration for secure payment processing.

- **Utilities & Tools:**
  - **TypeScript** throughout the stack for type-safe development.
  - **Async Error Handling** and custom middlewares in Express for robust API endpoints.
  - **Environment Variables** for sensitive config (e.g., Razorpay keys, DB credentials).
