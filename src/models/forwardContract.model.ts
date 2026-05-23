import mongoose, { Document, Schema } from 'mongoose';

export interface IForwardContract extends Document {
  // Contract Details
  referenceNumber: string;
  bookingDate?: Date;

  // Customer Details
  customerName?: string;
  customerId?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  country?: string;

  // Business Details
  entity?: string;
  bank?: string;

  // Contract Type
  typeOfBooking?: 'new' | 'rebooking' | 'without_rebooking';
  typeOfDelivery?: 'full' | 'partial' | 'optional';
  typeOfPurchase?: 'buy' | 'sell';
  purpose?: string;

  // Currency Details
  baseCurrency?: string;
  quoteCurrency?: string;

  // Amount Details
  amountInBase?: number;
  amountInQuote?: number;
  currentRate?: number;
  forwardRate?: number;
  premiumDiscount?: number;

  // Metadata
  status?: 'active' | 'completed' | 'confirm' | 'incomplete' | 'pending' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

const forwardContractSchema = new Schema<IForwardContract>(
  {
    // Contract Details
    referenceNumber: {
      type: String,
      required: [true, 'Reference number is required'],
      unique: true,
      trim: true,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },

    // Customer Details
    customerName: {
      type: String,
      trim: true,
    },
    customerId: {
      type: String,
      trim: true,
    },
    address1: {
      type: String,
      trim: true,
    },
    address2: {
      type: String,
      trim: true,
    },
    address3: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },

    // Business Details
    entity: {
      type: String,
      trim: true,
    },
    bank: {
      type: String,
      trim: true,
    },

    // Contract Type
    typeOfBooking: {
      type: String,
      enum: ['new', 'rebooking', 'without_rebooking'],
      default: 'new',
    },
    typeOfDelivery: {
      type: String,
      enum: ['full', 'partial', 'optional'],
      default: 'full',
    },
    typeOfPurchase: {
      type: String,
      enum: ['buy', 'sell'],
    },
    purpose: {
      type: String,
      trim: true,
    },

    // Currency Details
    baseCurrency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    quoteCurrency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    // Amount Details
    amountInBase: {
      type: Number,
      min: [0, 'Amount must be positive'],
    },
    amountInQuote: {
      type: Number,
      min: [0, 'Amount must be positive'],
    },
    currentRate: {
      type: Number,
      min: [0, 'Rate must be positive'],
    },
    forwardRate: {
      type: Number,
      min: [0, 'Rate must be positive'],
    },
    premiumDiscount: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'completed', 'confirm', 'incomplete', 'pending', 'draft'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
forwardContractSchema.index({ customerId: 1 });
forwardContractSchema.index({ bookingDate: -1 });
forwardContractSchema.index({ status: 1 });
forwardContractSchema.index({ baseCurrency: 1, quoteCurrency: 1 });

// Generate reference number before saving
forwardContractSchema.pre('validate', async function (next) {
  if (this.isNew && !this.referenceNumber) {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.referenceNumber = `FC-${year}-${randomNum}`;
  }
  next();
});

const ForwardContract = mongoose.model<IForwardContract>('ForwardContract', forwardContractSchema);

export default ForwardContract;
