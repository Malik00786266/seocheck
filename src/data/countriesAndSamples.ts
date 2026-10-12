export interface CountryOption {
  name: string;
  code: string;
  region: string;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { name: 'United States', code: 'US', region: 'North America' },
  { name: 'Pakistan', code: 'PK', region: 'South Asia' },
  { name: 'India', code: 'IN', region: 'South Asia' },
  { name: 'United Kingdom', code: 'GB', region: 'Europe' },
  { name: 'Canada', code: 'CA', region: 'North America' },
  { name: 'Australia', code: 'AU', region: 'Oceania' },
  { name: 'United Arab Emirates', code: 'AE', region: 'Middle East' },
  { name: 'Saudi Arabia', code: 'SA', region: 'Middle East' },
  { name: 'Germany', code: 'DE', region: 'Europe' },
  { name: 'France', code: 'FR', region: 'Europe' },
  { name: 'Singapore', code: 'SG', region: 'Southeast Asia' },
  { name: 'Malaysia', code: 'MY', region: 'Southeast Asia' },
  { name: 'Nigeria', code: 'NG', region: 'Africa' },
  { name: 'South Africa', code: 'ZA', region: 'Africa' },
  { name: 'Brazil', code: 'BR', region: 'South America' },
  { name: 'Mexico', code: 'MX', region: 'North America' },
  { name: 'Spain', code: 'ES', region: 'Europe' },
  { name: 'Italy', code: 'IT', region: 'Europe' },
  { name: 'Netherlands', code: 'NL', region: 'Europe' },
  { name: 'Japan', code: 'JP', region: 'East Asia' },
  { name: 'Indonesia', code: 'ID', region: 'Southeast Asia' },
  { name: 'Bangladesh', code: 'BD', region: 'South Asia' },
  { name: 'Turkey', code: 'TR', region: 'Europe / Middle East' },
  { name: 'Ireland', code: 'IE', region: 'Europe' },
  { name: 'New Zealand', code: 'NZ', region: 'Oceania' },
];

export const CONTENT_TYPES = [
  'Informational Article',
  'Tutorial / How-To Guide',
  'Government Scheme Information',
  'Product Review',
  'Comparison Article',
  'News Report',
  'Commercial / Product Content',
  'Technical Documentation',
];

export const SUPPORTED_LANGUAGES = [
  'Auto-Detect',
  'English',
  'Urdu / Arabic Script',
  'Hindi (Devanagari)',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Indonesian',
];

export const SAMPLE_AUDIT_PRESETS = [
  {
    label: 'Sample 1: Technical SEO & Core Web Vitals Guide (US)',
    articleTitle: 'Core Web Vitals Optimization Guide: How to Fix LCP and INP Issues',
    focusKeyword: 'Core Web Vitals optimization',
    targetCountry: 'United States',
    language: 'English',
    contentType: 'Tutorial / How-To Guide',
    articleUrl: '',
    articleContent: `# Core Web Vitals Optimization Guide: How to Fix LCP and INP Issues

Core Web Vitals optimization is very important for every website owner who wants better rankings in Google Search. In today's fast-paced digital world, page speed and user experience play a role in how visitors interact with your pages. If your site is slow, users will bounce immediately.

## What Are Core Web Vitals?

Core Web Vitals are a set of metrics from Google that measure real-world user experience for loading performance, interactivity, and visual stability. The three main metrics are Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS). Having good scores guarantees that your website will rank #1 on Google Search within a few weeks.

## How to Improve LCP

Largest Contentful Paint measures how long it takes for the largest image or text block to become visible in the viewport. To achieve good Core Web Vitals optimization, your LCP should occur within 2.5 seconds of when the page first starts loading.

Many websites suffer from slow LCP because their server response time is slow or because hero images are not optimized. You should compress images and use a faster server.

#### Image Formats

Using WebP or AVIF formats helps reduce payload size. You should also avoid lazy-loading your main hero image above the fold.

## Fixing Interactivity and Layout Shifts

When a user clicks a button on your page, the browser should respond quickly. Long JavaScript tasks block the main thread and delay interaction. You can break up long tasks and remove unused third-party scripts.

For Cumulative Layout Shift (CLS), always include width and height size attributes on your images and video elements so the browser allocates the correct amount of space while the image loads.

## Conclusion

In conclusion, Core Web Vitals optimization is essential for Core Web Vitals optimization success. By improving your speed, you will satisfy Google's algorithm and get more traffic. Click here to read more about speed tools.`,
  },
  {
    label: 'Sample 2: Solar Net Metering Policy & Application Guide (Pakistan)',
    articleTitle: 'Solar Net Metering in Pakistan: Eligibility, NEPRA Rules & Application Process',
    focusKeyword: 'solar net metering in Pakistan',
    targetCountry: 'Pakistan',
    language: 'English',
    contentType: 'Government Scheme Information',
    articleUrl: '',
    articleContent: `# Solar Net Metering in Pakistan: Eligibility, NEPRA Rules & Application Process

Installing a solar system with solar net metering in Pakistan allows residential and commercial electricity consumers to export excess solar units back to the national grid. With rising electricity tariffs across DISCOs like LESCO, IESCO, and K-Electric, understanding the official distributed generation process is essential before investing in an on-grid or hybrid inverter setup.

## What Is Net Metering and How Does It Work?

Net metering is a billing mechanism regulated by the National Electric Power Regulatory Authority (NEPRA) that credits solar system owners for the electricity they add to the grid. When your solar panels generate more electricity during peak daylight hours than your home consumes, the bidirectional green meter records the exported kilowatt-hours (kWh).

## Eligibility Requirements

To qualify for a three-phase net metering connection in Pakistan, applicants must have a three-phase electricity connection and an AEDB-certified solar installer. Single-phase domestic connections can also apply for net metering without upgrading their connection.

### Required Documents for DISCO Submission

- Copy of recent electricity bill and CNIC of the registered consumer
- Technical feasibility and single-line diagram prepared by an authorized installer
- NOC and application forms for distributed generation license

## Conclusion

Applying for solar net metering in Pakistan reduces monthly bills significantly. Make sure your earthing and inverter protection settings meet utility safety standards before inspection.`,
  },
];
