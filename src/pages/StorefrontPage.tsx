import { ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";

/**
 * StorefrontPage — legacy public storefront URL (/store/:accountId).
 * Standalone creator storefronts have moved into the in-app Creator Shop,
 * where purchases are fulfilled by Lovable-managed payments and creators
 * are paid through payout requests.
 */
export default function StorefrontPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SEO
        title="Creator Storefront — Oracle Lunar"
        description="Creator storefronts now live in the Oracle Lunar Creator Shop."
        path="/store"
      />
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="p-8 text-center space-y-4 bg-card/60 border-primary/20">
          <ShoppingBag className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-xl font-bold">This storefront has moved</h1>
          <p className="text-sm text-muted-foreground">
            Creators now sell their work inside the Oracle Lunar Creator Shop. Open the app
            to browse and buy — every purchase supports the creator directly.
          </p>
          <Link
            to="/library/public"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5"
          >
            Open the Creator Shop <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>
    </main>
  );
}
