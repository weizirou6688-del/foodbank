import type { FormEvent } from 'react'
import { Check, ChevronRight, MapPin, Search } from '@/shared/ui/InlineIcons'
import {
  getEnglishInputValidationProps,
  getEnglishSelectValidationProps,
  getEnglishTextAreaValidationProps,
} from '@/shared/lib/nativeValidation'
import { normalizePostcodeInput, sanitizeDateTextInput } from '@/shared/lib/validation'
import { styles } from '../donateGoodsStyles'
import type { DonationDetails, FeedbackState, FieldErrors, FoodBankOption } from '../donateGoods.types'

const postcodeValidationProps = getEnglishInputValidationProps('Postcode')
const donorNameValidationProps = getEnglishInputValidationProps('Full Name')
const donorEmailValidationProps = getEnglishInputValidationProps('Email Address')
const donorPhoneValidationProps = getEnglishInputValidationProps('Phone Number')
const pickupDateValidationProps = getEnglishInputValidationProps('Preferred Collection or Drop-off Date')
const donationItemsValidationProps = getEnglishTextAreaValidationProps('Donation Items')
const itemConditionValidationProps = getEnglishSelectValidationProps('Item Condition')
const estimatedQuantityValidationProps = getEnglishInputValidationProps('Estimated Quantity')
const specialNotesValidationProps = getEnglishTextAreaValidationProps('Special Instructions or Notes')

type SearchLocationStepProps = {
  postcode: string
  postcodeError: string
  searching: boolean
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onPostcodeChange: (value: string) => void
  onClearPostcodeError: () => void
  onClearSearchFeedback: () => void
}

export function SearchLocationStep({
  postcode,
  postcodeError,
  searching,
  onSearch,
  onPostcodeChange,
  onClearPostcodeError,
  onClearSearchFeedback,
}: SearchLocationStepProps) {
  return (
    <div className={styles.flowCard}>
      <div className={styles.flowCardHeader}>
        <h3 className={styles.flowTitle}>
          Find a <span className={styles.highlight}>Food Bank</span> Near You
        </h3>
        <p className={styles.flowText}>
          Enter your postcode to search for food banks within 5 km
        </p>
      </div>

      <form onSubmit={onSearch}>
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrap}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              placeholder="Enter Postcode"
              value={postcode}
              onChange={(event) => {
                onPostcodeChange(normalizePostcodeInput(event.target.value))
                onClearPostcodeError()
                onClearSearchFeedback()
              }}
              maxLength={8}
              className={styles.searchInput}
              {...postcodeValidationProps}
            />
          </div>
          <button type="submit" className={styles.primaryActionButton} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {postcodeError ? <p className={styles.fieldError}>{postcodeError}</p> : null}
      </form>
    </div>
  )
}

type SelectFoodBankStepProps = {
  searchFeedback: string | null
  searchResults: FoodBankOption[]
  onBack: () => void
  onSelectBank: (bank: FoodBankOption) => void
}

export function SelectFoodBankStep({
  searchFeedback,
  searchResults,
  onBack,
  onSelectBank,
}: SelectFoodBankStepProps) {
  return (
    <div className={styles.flowStepStack}>
      <button type="button" onClick={onBack} className={styles.ghostActionButton}>
        Change Location
      </button>

      <div className={styles.flowCard}>
        <div className={styles.flowCardHeaderLeft}>
          <h3 className={styles.flowTitle}>
            Select a <span className={styles.highlight}>Food Bank</span>
          </h3>
        </div>

        {searchFeedback && searchResults.length > 0 ? (
          <p className={styles.flowTextLeft}>{searchFeedback}</p>
        ) : null}

        <div className={styles.bankList}>
          {searchResults.length === 0 ? (
            <p className={styles.flowTextLeft}>
              {searchFeedback ?? 'Try another postcode to load nearby foodbanks.'}
            </p>
          ) : (
            searchResults.map((bank) => (
              <button
                key={bank.id}
                type="button"
                className={styles.bankCard}
                onClick={() => onSelectBank(bank)}
              >
                <div className={styles.bankCardTop}>
                  <div>
                    <h4 className={styles.bankName}>{bank.name}</h4>
                    <div className={styles.bankAddress}>
                      <MapPin size={16} />
                      <span>{bank.address}</span>
                    </div>
                    <span className={styles.bankDistance}>{bank.distance} away</span>
                  </div>
                  <ChevronRight className={styles.bankArrow} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

type DonationDetailsStepProps = {
  selectedBank: FoodBankOption
  details: DonationDetails
  fieldErrors: FieldErrors
  submitFeedback: FeedbackState | null
  submitting: boolean
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUpdateDetails: (field: keyof DonationDetails, value: string) => void
  onNormalizePickupDateField: () => void
}

export function DonationDetailsStep({
  selectedBank,
  details,
  fieldErrors,
  submitFeedback,
  submitting,
  onBack,
  onSubmit,
  onUpdateDetails,
  onNormalizePickupDateField,
}: DonationDetailsStepProps) {
  return (
    <div className={styles.flowStepStack}>
      <button type="button" onClick={onBack} className={styles.ghostActionButton}>
        Choose Different Food Bank
      </button>

      <div className={styles.selectedBankCard}>
        <div className={styles.selectedBankHeader}>
          <div className={styles.selectedBankBadge}>
            <Check size={22} />
          </div>
          <div>
            <p className={styles.selectedBankLabel}>Donating to:</p>
            <h3 className={styles.selectedBankName}>{selectedBank.name}</h3>
            <p className={styles.selectedBankAddress}>{selectedBank.address}</p>
            <p className={styles.flowTextLeft}>
              Your donation request will be sent to this food bank. Their team will
              contact you to arrange collection or drop-off.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className={styles.flowCard}>
        <div className={styles.flowCardHeaderCentered}>
          <h3 className={styles.flowTitle}>
            Your <span className={styles.highlight}>Donation Details</span>
          </h3>
          <p className={styles.flowTextLeft}>
            Please provide the details the selected food bank team will need to follow up
          </p>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label htmlFor="donor-name" className={styles.formLabel}>
              Full Name *
            </label>
            <input
              id="donor-name"
              type="text"
              value={details.name}
              onChange={(event) => onUpdateDetails('name', event.target.value)}
              className={styles.formInput}
              {...donorNameValidationProps}
            />
            {fieldErrors.name ? <p className={styles.fieldError}>{fieldErrors.name}</p> : null}
          </div>

          <div className={styles.formField}>
            <label htmlFor="donor-email" className={styles.formLabel}>
              Email Address *
            </label>
            <input
              id="donor-email"
              type="email"
              value={details.email}
              onChange={(event) => onUpdateDetails('email', event.target.value)}
              className={styles.formInput}
              {...donorEmailValidationProps}
            />
            {fieldErrors.email ? <p className={styles.fieldError}>{fieldErrors.email}</p> : null}
          </div>

          <div className={styles.formField}>
            <label htmlFor="donor-phone" className={styles.formLabel}>
              Phone Number *
            </label>
            <input
              id="donor-phone"
              type="tel"
              value={details.phone}
              onChange={(event) => onUpdateDetails('phone', event.target.value)}
              className={styles.formInput}
              {...donorPhoneValidationProps}
            />
            {fieldErrors.phone ? <p className={styles.fieldError}>{fieldErrors.phone}</p> : null}
          </div>

          <div className={styles.formField}>
            <label htmlFor="pickup-date" className={styles.formLabel}>
              Preferred Collection or Drop-off Date *
            </label>
            <input
              id="pickup-date"
              type="text"
              value={details.pickupDate}
              onChange={(event) => onUpdateDetails('pickupDate', sanitizeDateTextInput(event.target.value))}
              onBlur={onNormalizePickupDateField}
              inputMode="numeric"
              maxLength={10}
              placeholder="DD/MM/YYYY"
              className={styles.formInput}
              {...pickupDateValidationProps}
            />
            {fieldErrors.pickupDate ? (
              <p className={styles.fieldError}>{fieldErrors.pickupDate}</p>
            ) : null}
          </div>
        </div>

        <div className={styles.formField}>
          <label htmlFor="donation-items" className={styles.formLabel}>
            What are you donating? *
          </label>
          <textarea
            id="donation-items"
            value={details.items}
            onChange={(event) => onUpdateDetails('items', event.target.value)}
            placeholder="Please describe the items you'd like to donate, for example canned vegetables, pasta, cereal, shampoo, or nappies."
            className={styles.formTextarea}
            {...donationItemsValidationProps}
          />
          {fieldErrors.items ? <p className={styles.fieldError}>{fieldErrors.items}</p> : null}
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label htmlFor="item-condition" className={styles.formLabel}>
              Item Condition *
            </label>
            <select
              id="item-condition"
              value={details.condition}
              onChange={(event) => onUpdateDetails('condition', event.target.value)}
              className={styles.formSelect}
              {...itemConditionValidationProps}
            >
              <option value="">Select condition</option>
              <option value="New or unopened">New or unopened</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
            </select>
            {fieldErrors.condition ? (
              <p className={styles.fieldError}>{fieldErrors.condition}</p>
            ) : null}
          </div>

          <div className={styles.formField}>
            <label htmlFor="estimated-quantity" className={styles.formLabel}>
              Estimated Quantity
            </label>
            <input
              id="estimated-quantity"
              type="text"
              value={details.quantity}
              onChange={(event) => onUpdateDetails('quantity', event.target.value)}
              placeholder="For example 2 bags, 1 box"
              className={styles.formInput}
              {...estimatedQuantityValidationProps}
            />
          </div>
        </div>

        <div className={styles.formField}>
          <label htmlFor="special-notes" className={styles.formLabel}>
            Special Instructions or Notes
          </label>
          <textarea
            id="special-notes"
            value={details.notes}
            onChange={(event) => onUpdateDetails('notes', event.target.value)}
            placeholder="Any pickup instructions, accessibility notes, or other details..."
            className={styles.formTextareaSmall}
            {...specialNotesValidationProps}
          />
        </div>

        {submitFeedback ? (
          <div
            className={
              submitFeedback.type === 'success'
                ? styles.feedbackSuccess
                : styles.feedbackError
            }
            role={submitFeedback.type === 'error' ? 'alert' : 'status'}
          >
            {submitFeedback.message}
          </div>
        ) : null}

        <button type="submit" disabled={submitting} className={styles.primaryActionWide}>
          {submitting ? 'Submitting Donation...' : 'Send Donation Request'}
        </button>
      </form>
    </div>
  )
}
