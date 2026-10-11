/*
 * Breed list for the prototypes.
 *
 * ARBA: the American Rabbit Breeders Association's recognized breeds,
 * https://arba.net/recognized-breeds/ (read 2026-10-10). 53 rabbit breeds;
 * the Mini Californian is the 53rd. Cavies on that page are not rabbits.
 *
 * Other: breeds recognized by the British Rabbit Council but not by ARBA,
 * https://www.thebritishrabbitcouncil.org/rabbit-breeds.php and the BRC
 * Breed Standards. Names that clash with an ARBA breed are left out.
 *
 * This is the same list the Django app seeds in its breed migration.
 */
window.RabbitBreeds = {
  sources: [
    { label: "ARBA recognized breeds", url: "https://arba.net/recognized-breeds/" },
    {
      label: "British Rabbit Council breeds",
      url: "https://www.thebritishrabbitcouncil.org/rabbit-breeds.php",
    },
  ],
  arba: [
    "American", "American Chinchilla", "American Fuzzy Lop", "American Sable",
    "Argente Brun", "Belgian Hare", "Beveren", "Blanc de Hotot", "Blue Holicer",
    "Britannia Petite", "Californian", "Champagne d'Argent", "Checkered Giant",
    "Cinnamon", "Creme d'Argent", "Czech Frosty", "Dutch", "Dwarf Hotot",
    "Dwarf Papillon", "English Angora", "English Lop", "English Spot",
    "Flemish Giant", "Florida White", "French Angora", "French Lop",
    "Giant Angora", "Giant Chinchilla", "Harlequin", "Havana", "Himalayan",
    "Holland Lop", "Jersey Wooly", "Lilac", "Lionhead", "Mini Californian",
    "Mini Lop", "Mini Rex", "Mini Satin", "Netherland Dwarf", "New Zealand",
    "Palomino", "Polish", "Rex", "Rhinelander", "Satin", "Satin Angora",
    "Silver", "Silver Fox", "Silver Marten", "Standard Chinchilla", "Tan",
    "Thrianta",
  ],
  other: [
    "Alaska", "Argente Bleu", "Argente Noir", "Astrex", "Beige",
    "Blanc de Bouscat", "Blanc de Termonde", "British Giant", "Cashmere Lop",
    "Chinchilla Giganta", "Continental Giant", "Deilenaar", "Dwarf Lop",
    "Giant Papillon", "Golden Glavcot", "Hulstlander", "Meissner Lop",
    "Miniature Cashmere Lop", "Miniature Lion Lop", "Opossum", "Perlfee",
    "Pointed Beveren", "Sallander", "Siamese Sable", "Siberian", "Smoke Pearl",
    "Squirrel", "Sussex", "Swiss Fox", "Thuringer", "Vienna", "Wheaten",
    "Wheaten Lynx",
  ],
};
