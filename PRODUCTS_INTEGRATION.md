# Products Management - Implementation Guide

## Overview
This document describes the complete backend and frontend integration for product management in the K-Enterprises system.

## Backend Implementation

### New Files Created
1. **`products.py`** - Product management functions for Google Sheets integration

### Modified Files
1. **`config.py`** - Added `PRODUCTS_SHEET_NAME` configuration
2. **`models.py`** - Added `ProductCreate` and `ProductUpdate` Pydantic models
3. **`main.py`** - Added product endpoints

### Backend API Endpoints

#### 1. Create Product
- **Endpoint:** `POST /products/`
- **Request Body:**
```json
{
  "name": "Product Name",
  "quantity": 100,
  "unit": "Kg",
  "pricePerUnit": 99.99
}
```
- **Response:** 
```json
{
  "id": 1,
  "row": 2,
  "status": "success",
  "message": "Product created successfully"
}
```

#### 2. List All Products
- **Endpoint:** `GET /products/`
- **Response:**
```json
[
  {
    "id": 1,
    "name": "Product A",
    "quantity": 100,
    "unit": "Kg",
    "pricePerUnit": 99.99,
    "totalValue": 9999.00,
    "createdDate": "2024-12-10T10:30:00",
    "updatedDate": "2024-12-10T10:30:00",
    "row": 2
  }
]
```

#### 3. Get Single Product
- **Endpoint:** `GET /products/{product_id}`
- **Response:** Single product object (same as above)

#### 4. Update Product
- **Endpoint:** `PUT /products/{product_id}`
- **Request Body:**
```json
{
  "name": "Updated Name",
  "quantity": 150,
  "unit": "pc",
  "pricePerUnit": 149.99
}
```
- **Response:**
```json
{
  "id": 1,
  "status": "success",
  "message": "Product updated successfully"
}
```

#### 5. Delete Product
- **Endpoint:** `DELETE /products/{product_id}`
- **Response:**
```json
{
  "id": 1,
  "status": "success",
  "message": "Product deleted successfully"
}
```

## Google Sheets Integration

### Sheet Structure
The `Products` sheet is created automatically with the following columns:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | ID | Integer | Auto-incremented product ID |
| B | Name | String | Product name |
| C | Quantity | Integer | Quantity in units |
| D | Unit | String | Unit type (Kg, g, pc, box) |
| E | Price Per Unit | Float | Price per unit |
| F | Total Value | Formula | =C*E (calculated automatically) |
| G | Created Date | DateTime | Auto-set on creation |
| H | Updated Date | DateTime | Auto-updated on each edit |

### Features
- **Auto-creation:** Products sheet is created automatically if it doesn't exist
- **Auto-increment:** Product IDs are auto-incremented based on row count
- **Calculated fields:** Total Value is calculated using a formula
- **Timestamps:** Created and Updated dates are automatically managed

## Frontend Implementation

### File Modified
- **`frontend/app/admin/products/page.tsx`** - Complete product management UI

### Features Implemented

#### 1. Product Display
- List view of all products with pagination
- Search functionality to filter products by name
- Loading states and error handling
- Responsive table design

#### 2. Product Creation
- Modal dialog with form validation
- Input fields: Name, Quantity, Unit (dropdown), Price per Unit
- Real-time price calculation display
- Success/error toast notifications

#### 3. Product Editing
- Click "Edit" button to modify any product
- Form pre-fills with existing product data
- Same validation as create
- Updates reflected immediately after save

#### 4. Product Deletion
- Click "Delete" button with confirmation dialog
- Safely removes products from sheet
- Immediate UI update after deletion

#### 5. Calculations
- **Total Value** = Quantity × Price Per Unit
- Displayed in the table for quick reference

## Environment Configuration

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Change the URL if your backend runs on a different host/port.

## Running the Application

### Backend
```bash
cd backend1
source venv/Scripts/activate  # or use appropriate activation script
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm run dev
```

Then navigate to: `http://localhost:3000/admin/products`

## Error Handling

### Backend
- Returns appropriate HTTP status codes (200, 404, 500)
- Includes error messages in responses
- Logs all errors to console
- Handles missing/invalid data gracefully

### Frontend
- Shows user-friendly toast notifications for errors
- Loading states prevent user confusion
- Confirmation dialogs prevent accidental deletions
- Form validation before submission

## Data Validation

### Product Fields
- **Name:** Required, non-empty string
- **Quantity:** Required, positive integer
- **Unit:** Required, one of (Kg, g, pc, box)
- **Price Per Unit:** Required, positive float

## API Error Responses

### 404 Product Not Found
```json
{
  "detail": "Product not found"
}
```

### 400 Invalid Data
```json
{
  "detail": "Please fill in all required fields"
}
```

### 500 Server Error
```json
{
  "detail": "Failed to create product: [error message]"
}
```

## Testing the Integration

1. **Create a product:**
   - Click "Add Product" button
   - Fill in form fields
   - Click "Add Product"
   - Verify product appears in table

2. **Edit a product:**
   - Click "Edit" button on any product
   - Modify fields
   - Click "Update Product"
   - Verify changes in table

3. **Delete a product:**
   - Click "Delete" button
   - Confirm deletion
   - Verify product is removed

4. **Search products:**
   - Type in search box
   - Table filters in real-time

## Troubleshooting

### Products not loading
1. Check if backend is running: `http://localhost:8000/docs`
2. Verify `.env.local` has correct API URL
3. Check browser console for errors
4. Ensure Google Sheets authentication is working

### Add/Edit/Delete not working
1. Check backend logs for error messages
2. Verify Google Sheets API permissions
3. Ensure Products sheet exists in spreadsheet
4. Check network tab in browser DevTools

### Calculation showing wrong values
- Total Value is calculated server-side
- Ensure quantity and price are numeric values
- Clear browser cache and reload

## Future Enhancements
- Batch import/export functionality
- Advanced filtering and sorting
- Product categories
- Stock level alerts
- Price history tracking
- Multiple unit conversion
