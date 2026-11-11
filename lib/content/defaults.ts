import type { Settings } from "@/types/db";

/**
 * Fallback content used until an admin saves a value (and when Supabase isn't reachable).
 * RULES: only facts verified on the existing bewithyoga.live site. No invented biography, qualifications,
 * testimonials, retreat dates or class schedules. Anything unknown is an honest, clearly editable placeholder.
 * Everything here is editable in Admin → Content.
 */
export const IMG = {
  hero: "https://bewithyoga.live/wp-content/uploads/2020/10/122036635_10223193197128847_4541167618081591532_o.jpg",
  retreat1: "https://bewithyoga.live/wp-content/uploads/2019/06/62532142_10218773372115984_923381087755829248_n.jpg",
  retreat2: "https://bewithyoga.live/wp-content/uploads/2023/05/400591.jpg",
  about: "https://bewithyoga.files.wordpress.com/2017/04/dscn3990-e1491142252229.jpg",
  schedule: "https://bewithyoga.files.wordpress.com/2016/10/10555239_10153380159591317_219961796_n.jpg",
  gallery: "https://bewithyoga.files.wordpress.com/2017/04/img-20160522-wa0001-e1491142538708.jpg",
};

export type Content = Record<string, string>;

export const DEFAULT_PAGES: Record<string, { title: string; content: Content; seo_title?: string; seo_description?: string }> = {
  home: {
    title: "Home",
    seo_title: "Yoga classes & retreats in Mallorca",
    seo_description: "Yoga with Angela in Mallorca — group classes at Bodhana Wellness Centre, Puerto Portals, and retreats. Stay with an open heart.",
    content: {
      hero_visible: "true",
      hero_eyebrow: "Yoga in Mallorca with Angela",
      hero_title: "Be With Yoga",
      hero_subtitle: "Stay with an open heart",
      hero_cta_label: "View the schedule",
      hero_cta_href: "/schedule",
      hero_cta2_label: "Book a class",
      hero_cta2_href: "/book",
      hero_image: IMG.hero,
      hero_image_alt: "Angela practising yoga",

      intro_visible: "true",
      intro_heading: "A practice to come home to",
      intro_body: "Be With Yoga is Angela's yoga practice in Mallorca: group classes at Bodhana Wellness Centre in Puerto Portals, and retreats on the island.",

      classes_visible: "true",
      classes_eyebrow: "Classes",
      classes_heading: "Explore yoga classes",
      classes_body: "Join Angela in person. Choose a class, pick a date and book your place online.",

      retreats_visible: "true",
      retreats_eyebrow: "Retreats",
      retreats_heading: "Retreats in Mallorca",
      retreats_body: "Time away, on the island, with yoga at the centre of it.",
      retreats_empty: "Retreat details are coming soon. Leave your email below and you'll hear first.",

      about_visible: "true",
      about_eyebrow: "About Angela",
      about_heading: "Meet Angela",
      about_body: "",
      about_image: IMG.about,
      about_image_alt: "Angela, yoga teacher in Mallorca",
      about_cta_label: "More about Angela",

      philosophy_visible: "true",
      philosophy_eyebrow: "Philosophy",
      philosophy_heading: "Body, breath and a quiet mind",
      philosophy_body: "Yoga means union. On the mat we bring body, breath and attention into the same place.",
      benefit1_title: "Strength & ease",
      benefit1_text: "Move with awareness and build a body that feels strong and at home.",
      benefit2_title: "Calm & focus",
      benefit2_text: "Slow the breath and the mind follows.",
      benefit3_title: "Presence",
      benefit3_text: "Return to the present moment, on and off the mat.",

      gallery_visible: "true",
      gallery_eyebrow: "Gallery",
      gallery_heading: "Moments from the mat",

      journal_visible: "true",
      journal_eyebrow: "Journal",
      journal_heading: "From the journal",

      testimonials_visible: "true",
      testimonials_heading: "Kind words",

      private_visible: "true",
      private_eyebrow: "One to one",
      private_heading: "Private sessions",
      private_body: "A practice shaped around you, in person in Mallorca or online. Tell Angela what you're looking for and she will reply personally.",
      private_cta_label: "Request a private session",
      howto_visible: "true",
      howto_eyebrow: "Good to know",
      howto_heading: "Booking & cancellation",
      howto_body: "Choose a class and a date, pay securely online, and your place is confirmed straight away with an email. Need to change plans? Cancel online with your booking reference.",
      newsletter_visible: "true",
      newsletter_heading: "Stay in touch",
      newsletter_body: "Enter your email to follow Angela and receive updates on classes and retreats.",

      contact_visible: "true",
      contact_heading: "Let's practise together",
      contact_body: "Questions about classes, private sessions or retreats? Get in touch.",
      contact_cta_label: "Contact Angela",
    },
  },
  about: {
    title: "About Angela",
    seo_title: "About Angela — yoga teacher in Mallorca",
    seo_description: "Meet Angela, yoga teacher in Mallorca, and learn about her approach to yoga.",
    content: {
      hero_eyebrow: "About",
      hero_title: "About Angela",
      hero_subtitle: "Yoga teacher in Mallorca",
      portrait: IMG.about,
      portrait_alt: "Angela, yoga teacher in Mallorca",
      bio_heading: "Her story",
      bio_body: "",
      bio_empty: "Angela's story is coming soon.",
      philosophy_heading: "Teaching philosophy",
      philosophy_body: "",
      experience_heading: "Experience & qualifications",
      experience_body: "",
      approach_heading: "Personal approach",
      approach_body: "",
      photo2: IMG.schedule,
      photo2_alt: "A Be With Yoga class",
      cta_heading: "Practise with Angela",
      cta_body: "Join a class, or get in touch to talk about private sessions and retreats.",
      cta_label: "Get in touch",
    },
  },
  private: {
    title: "Private sessions",
    seo_title: "Private yoga sessions in Mallorca",
    seo_description: "Request a one-to-one or small-group private yoga session with Angela, in person in Mallorca or online.",
    content: {
      hero_eyebrow: "One to one",
      hero_title: "Private sessions",
      hero_subtitle: "A practice shaped around you. Tell Angela what you're looking for and she will reply personally.",
      body: [
        "Private sessions are arranged individually, so there is no fixed timetable. Send a request below with the days and times that suit you, and whether you'd like to practise in person or online.",
        "Angela will reply by email to agree a time and any details.",
      ].join("\n\n"),
    },
  },
  privacy: {
    title: "Privacy policy",
    seo_title: "Privacy policy",
    content: {
      body: [
        "## Who we are",
        "Be With Yoga is the yoga practice of Angela in Mallorca, Spain. You can reach us through the contact page.",
        "## What we collect",
        "When you book a class, request a private session, reserve a retreat place, send a message or subscribe to the newsletter, we store the details you give us: your name, email address, phone number (if you add one), the class or retreat you chose, the number of people, and your message.",
        "## Why we use it",
        "We use your details to manage your booking or request, to confirm it and remind you before a class, to reply to you, and — only if you subscribe — to send updates about classes and retreats. You can unsubscribe at any time.",
        "## Payments",
        "Card payments are handled by Stripe and PayPal on their own secure pages. We never see or store your card number. We keep a record that you paid, the amount and a payment reference, so we can confirm or refund your booking.",
        "## Who sees your data",
        "Your details are visible to Angela. They are stored with our service providers: our database and hosting provider, our email delivery provider, and Stripe and PayPal for payments. We do not sell your data.",
        "## Cookies",
        "This website does not use advertising or tracking cookies. Cookies are used only where they are strictly necessary, for example to keep an administrator signed in. If analytics or other cookies are added in future, this page will be updated and your consent asked for first.",
        "## How long we keep it",
        "We keep booking records for as long as needed to run the business and meet accounting obligations, and message and newsletter data until you ask us to remove it.",
        "## Your rights",
        "You may ask to see, correct, export or delete your data at any time, and you may complain to the Spanish data protection authority (AEPD). Email us and we will respond.",
        "_This is a plain-language summary and should be reviewed and adapted by the business owner before launch._",
      ].join("\n\n"),
    },
  },
};

export const DEFAULT_SETTINGS: Settings = {
  general: { site_name: "Be With Yoga", tagline: "Stay with an open heart", teacher_name: "Angela" },
  contact: {
    email: "bewithyoga@gmail.com", phone: "+34 662 410 119", whatsapp: "34662410119",
    location: "Puerto Portals, Mallorca, Spain", studio_name: "Bodhana Wellness Centre",
    studio_address: "Calle Benito Jerónimo Feijoo 2, Puerto Portals, Mallorca, Spain",
    map_query: "Bodhana Wellness Centre, Calle Benito Jerónimo Feijoo 2, Puerto Portals, Mallorca, Spain",
  },
  social: {
    instagram: "https://www.instagram.com/bewithyoga",
    facebook: "https://www.facebook.com/angela.s.santosa",
    twitter: "https://twitter.com/bewithyoga",
  },
  booking: { cancel_hours: "24", policy: "You can cancel online up to 24 hours before a class for a full refund. After that, bookings can't be refunded automatically — please get in touch and we'll do our best to help." },
  schedule_note: { text: "Group classes at Bodhana Wellness Centre: Mondays 18:00–20:00, Wednesdays 18:00–20:00, Fridays 10:00–12:00." },
};
