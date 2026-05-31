export type FoodsiApiItem = {
  id: string;
  attributes: {
    current_quantity?: number;
    description?: string;
    name?: string;
    unit_price?: number | string;
    original_price?: number | string;
    pickup_from?: string;
    pickup_to?: string;
    venue_id?: number | string;
    venue_name?: string;
    venue_logo?: string;
    venue_address?: string;
    distance?: number | string;
  };
};

export type FoodsiApiResponse = {
  data?: FoodsiApiItem[];
  links?: {
    self?: string;
    next?: string | null;
  };
};
