import { type FormEvent } from "react";
import { cn } from "@/shared/lib/cn";
import type { FoodBankOption } from "@/shared/lib/foodBankLookup";
import {
  getEnglishInputValidationProps,
  getEnglishSelectValidationProps,
  getEnglishTextAreaValidationProps,
} from "@/shared/lib/nativeValidation";
import {
  normalizePostcodeInput,
  sanitizeDateTextInput,
} from "@/shared/lib/validation";
import {
  Check,
  ChevronRight,
  MapPin,
  Search,
} from "@/shared/ui/InlineIcons";
import {
  FormPanel,
  InlineFeedback,
  PublicFormField,
  PublicSelect,
  PublicTextArea,
  PublicTextInput,
} from "@/shared/ui/FormPrimitives";
import {
  ActionButton,
  PublicPageSection,
  PublicSearchPanel,
  PublicSectionIntro,
} from "@/shared/ui/PublicPagePatterns";
import {
  type DonateGoodsPageModel,
  type DonationDetails,
  type FeedbackState,
  type FieldErrors,
} from "./donateGoods.pageModel";
import styles from "./DonateGoods.module.css";

const FLOW_PROGRESS_LABELS = [
  "Search Location",
  "Select Food Bank",
  "Donation Details",
];

const postcodeValidationProps = getEnglishInputValidationProps("Postcode");
const donorNameValidationProps = getEnglishInputValidationProps("Full Name");
const donorEmailValidationProps =
  getEnglishInputValidationProps("Email Address");
const donorPhoneValidationProps =
  getEnglishInputValidationProps("Phone Number");
const pickupDateValidationProps = getEnglishInputValidationProps(
  "Preferred Collection or Drop-off Date",
);
const donationItemsValidationProps =
  getEnglishTextAreaValidationProps("Donation Items");
const itemConditionValidationProps =
  getEnglishSelectValidationProps("Item Condition");
const estimatedQuantityValidationProps =
  getEnglishInputValidationProps("Estimated Quantity");
const specialNotesValidationProps = getEnglishTextAreaValidationProps(
  "Special Instructions or Notes",
);

function SearchLocationStep({
  postcode,
  postcodeError,
  searching,
  onSearch,
  onPostcodeChange,
}: {
  postcode: string;
  postcodeError: string;
  searching: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onPostcodeChange: (value: string) => void;
}) {
  return (
    <div className={styles.flowCard}>
      <PublicSearchPanel
        title={
          <>
            Find a <span className={styles.highlight}>Food Bank</span> Near You
          </>
        }
        description="Enter your postcode to search for food banks within 5 km"
        value={postcode}
        onChange={(value) => onPostcodeChange(normalizePostcodeInput(value))}
        onSubmit={onSearch}
        placeholder="Enter Postcode"
        submitLabel="Search"
        submittingLabel="Searching..."
        isSubmitting={searching}
        icon={<Search className={styles.searchIcon} size={20} />}
        error={postcodeError}
        variant="embedded"
        align="center"
        introSize="section"
        introClassName={styles.searchPanelIntro}
        buttonClassName={styles.searchActionButton}
        inputProps={{ maxLength: 8, ...postcodeValidationProps }}
      />
    </div>
  );
}

function SelectFoodBankStep({
  searchFeedback,
  searchResults,
  onBack,
  onSelectBank,
}: {
  searchFeedback: string | null;
  searchResults: FoodBankOption[];
  onBack: () => void;
  onSelectBank: (bank: FoodBankOption) => void;
}) {
  return (
    <div className={styles.flowStepStack}>
      <ActionButton
        type="button"
        tone="ghost"
        size="sm"
        onClick={onBack}
        className={styles.ghostActionButton}
      >
        Change Location
      </ActionButton>
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
              {searchFeedback ?? "Try another postcode to load nearby foodbanks."}
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
  );
}

function DonationDetailsStep({
  details,
  fieldErrors,
  selectedBank,
  submitFeedback,
  submitting,
  onBack,
  onNormalizePickupDateField,
  onSubmit,
  onUpdateDetails,
}: {
  details: DonationDetails;
  fieldErrors: FieldErrors;
  selectedBank: FoodBankOption;
  submitFeedback: FeedbackState | null;
  submitting: boolean;
  onBack: () => void;
  onNormalizePickupDateField: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateDetails: (field: keyof DonationDetails, value: string) => void;
}) {
  return (
    <div className={styles.flowStepStack}>
      <ActionButton
        type="button"
        tone="ghost"
        size="sm"
        onClick={onBack}
        className={styles.ghostActionButton}
      >
        Choose Different Food Bank
      </ActionButton>
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
              Your donation request will be sent to this food bank. Their team
              will contact you to arrange collection or drop-off.
            </p>
          </div>
        </div>
      </div>
      <FormPanel onSubmit={onSubmit} className={styles.flowCard}>
        <div className={styles.flowCardHeaderCentered}>
          <h3 className={styles.flowTitle}>
            Your <span className={styles.highlight}>Donation Details</span>
          </h3>
          <p className={styles.flowTextLeft}>
            Please provide the details the selected food bank team will need to
            follow up
          </p>
        </div>
        <div className={styles.formGrid}>
          <PublicFormField
            id="donor-name"
            label="Full Name"
            required
            error={fieldErrors.name}
          >
            <PublicTextInput
              id="donor-name"
              type="text"
              value={details.name}
              onChange={(event) => onUpdateDetails("name", event.target.value)}
              {...donorNameValidationProps}
            />
          </PublicFormField>
          <PublicFormField
            id="donor-email"
            label="Email Address"
            required
            error={fieldErrors.email}
          >
            <PublicTextInput
              id="donor-email"
              type="email"
              value={details.email}
              onChange={(event) => onUpdateDetails("email", event.target.value)}
              {...donorEmailValidationProps}
            />
          </PublicFormField>
          <PublicFormField
            id="donor-phone"
            label="Phone Number"
            required
            error={fieldErrors.phone}
          >
            <PublicTextInput
              id="donor-phone"
              type="tel"
              value={details.phone}
              onChange={(event) => onUpdateDetails("phone", event.target.value)}
              {...donorPhoneValidationProps}
            />
          </PublicFormField>
          <PublicFormField
            id="pickup-date"
            label="Preferred Collection or Drop-off Date"
            required
            error={fieldErrors.pickupDate}
          >
            <PublicTextInput
              id="pickup-date"
              type="text"
              value={details.pickupDate}
              onChange={(event) =>
                onUpdateDetails(
                  "pickupDate",
                  sanitizeDateTextInput(event.target.value),
                )
              }
              onBlur={onNormalizePickupDateField}
              inputMode="numeric"
              maxLength={10}
              placeholder="DD/MM/YYYY"
              {...pickupDateValidationProps}
            />
          </PublicFormField>
        </div>
        <PublicFormField
          id="donation-items"
          label="What are you donating?"
          required
          error={fieldErrors.items}
        >
          <PublicTextArea
            id="donation-items"
            value={details.items}
            onChange={(event) => onUpdateDetails("items", event.target.value)}
            placeholder="Please describe the items you'd like to donate, for example canned vegetables, pasta, cereal, shampoo, or nappies."
            {...donationItemsValidationProps}
          />
        </PublicFormField>
        <div className={styles.formGrid}>
          <PublicFormField
            id="item-condition"
            label="Item Condition"
            required
            error={fieldErrors.condition}
          >
            <PublicSelect
              id="item-condition"
              value={details.condition}
              onChange={(event) =>
                onUpdateDetails("condition", event.target.value)
              }
              {...itemConditionValidationProps}
            >
              <option value="">Select condition</option>
              <option value="New or unopened">New or unopened</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
            </PublicSelect>
          </PublicFormField>
          <PublicFormField id="estimated-quantity" label="Estimated Quantity">
            <PublicTextInput
              id="estimated-quantity"
              type="text"
              value={details.quantity}
              onChange={(event) => onUpdateDetails("quantity", event.target.value)}
              placeholder="For example 2 bags, 1 box"
              {...estimatedQuantityValidationProps}
            />
          </PublicFormField>
        </div>
        <PublicFormField id="special-notes" label="Special Instructions or Notes">
          <PublicTextArea
            id="special-notes"
            value={details.notes}
            onChange={(event) => onUpdateDetails("notes", event.target.value)}
            placeholder="Any pickup instructions, accessibility notes, or other details..."
            compact
            {...specialNotesValidationProps}
          />
        </PublicFormField>
        {submitFeedback ? (
          <InlineFeedback
            tone={submitFeedback.type === "success" ? "success" : "error"}
            message={submitFeedback.message}
            role={submitFeedback.type === "error" ? "alert" : "status"}
            ariaLive="polite"
          />
        ) : null}
        <ActionButton
          type="submit"
          disabled={submitting}
          className={styles.primaryActionWide}
          fullWidthOnMobile
        >
          {submitting ? "Submitting Donation..." : "Send Donation Request"}
        </ActionButton>
      </FormPanel>
    </div>
  );
}

export function DonateGoodsFlowSection({
  model,
}: {
  model: DonateGoodsPageModel;
}) {
  // 流程逻辑由 page model 持有;本区块保持声明式,
  // 使文案和布局调整不与校验或提交规则耦合。
  const {
    details,
    fieldErrors,
    postcode,
    postcodeError,
    searchFeedback,
    searchResults,
    searching,
    selectedBank,
    step,
    submitFeedback,
    submitting,
    changePostcode,
    goToSearchStep,
    goToSelectBankStep,
    handleSearch,
    handleSelectBank,
    handleSubmitDonation,
    normalizePickupDateField,
    updateDetails,
  } = model;

  return (
    <PublicPageSection id="donate" width="page">
      <PublicSectionIntro
        title="Submit your donation request"
        description="Three steps: search by postcode, choose a food bank, and provide the donation details."
        className={styles.sectionHeader}
      />
      <div className={styles.flowShell}>
        <div className={styles.progressHeader}>
          <div className={styles.progressTrack}>
            <div
              className={cn(
                styles.progressDot,
                step >= 1 && styles.progressDotActive,
              )}
            >
              1
            </div>
            <div
              className={cn(
                styles.progressLine,
                step >= 2 && styles.progressLineActive,
              )}
            />
            <div
              className={cn(
                styles.progressDot,
                step >= 2 && styles.progressDotActive,
              )}
            >
              2
            </div>
            <div
              className={cn(
                styles.progressLine,
                step >= 3 && styles.progressLineActive,
              )}
            />
            <div
              className={cn(
                styles.progressDot,
                step >= 3 && styles.progressDotActive,
              )}
            >
              3
            </div>
          </div>
          <div className={styles.progressLabels}>
            {FLOW_PROGRESS_LABELS.map((label, index) => (
              <span
                key={label}
                className={step >= index + 1 ? styles.progressLabelActive : ""}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {step === 1 ? (
          <SearchLocationStep
            postcode={postcode}
            postcodeError={postcodeError}
            searching={searching}
            onSearch={handleSearch}
            onPostcodeChange={changePostcode}
          />
        ) : null}
        {step === 2 ? (
          <SelectFoodBankStep
            searchFeedback={searchFeedback}
            searchResults={searchResults}
            onBack={goToSearchStep}
            onSelectBank={handleSelectBank}
          />
        ) : null}
        {step === 3 && selectedBank ? (
          <DonationDetailsStep
            selectedBank={selectedBank}
            details={details}
            fieldErrors={fieldErrors}
            submitFeedback={submitFeedback}
            submitting={submitting}
            onBack={goToSelectBankStep}
            onSubmit={handleSubmitDonation}
            onUpdateDetails={updateDetails}
            onNormalizePickupDateField={normalizePickupDateField}
          />
        ) : null}
      </div>
    </PublicPageSection>
  );
}
