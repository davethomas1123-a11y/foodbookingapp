
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, LayoutList, PlusCircle, LogIn, UserPlus, UserCog, ShoppingBasket, MoreVertical, UtensilsCrossed } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, doc } from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet"

import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Order = {
  id: string;
  status: 'draft' | 'pending' | 'fulfilled';
};

type AppSettings = {
  logoUrl?: string;
};

export default function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const settingsDocRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings/app') : null), [firestore]);
  const { data: settings } = useDoc<AppSettings>(settingsDocRef);

  const draftOrdersQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(collection(firestore, 'customers', user.uid, 'orders'), where('status', '==', 'draft'))
        : null,
    [user, firestore]
  );
  const { data: draftOrders } = useCollection<Order>(draftOrdersQuery);

  const cartItemCount = draftOrders?.length || 0;

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
    });
    router.push('/login');
  };

  const navLinks = user
    ? [
        { href: "/", label: "Reserve", icon: PlusCircle },
        { href: "/cart", label: "Cart", icon: ShoppingBasket, badgeCount: cartItemCount },
        { href: "/account", label: "Account", icon: UserCog },
        { href: "/admin", label: "Admin", icon: LayoutList },
      ]
    : [
        { href: "/login", label: "Login", icon: LogIn },
        { href: "/signup", label: "Sign Up", icon: UserPlus },
      ];

  return (
    <>
      {/* Desktop Header */}
      <header className="bg-card border-b shadow-sm w-full hidden sm:block">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
             <Link href="/" className="flex items-center gap-2">
                {settings?.logoUrl ? (
                    <Image src={settings.logoUrl} alt="Logo" width={32} height={32} className="rounded-full" />
                ) : (
                    <UtensilsCrossed className="h-6 w-6 text-primary" />
                )}
                <span className="font-bold text-lg hidden md:inline">Food Reservations</span>
            </Link>
            <nav className="flex items-center justify-center gap-1">
              {isUserLoading ? (
                 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              ) : (
                <>
                  {navLinks.map(({ href, label, icon: Icon, badgeCount }) => (
                    <Button key={href} asChild variant={pathname === href ? 'secondary' : 'ghost'} className="relative flex flex-col h-16 px-4">
                        <Link href={href}>
                            <Icon />
                            <span className="text-xs">{label}</span>
                            {badgeCount && badgeCount > 0 ? (
                                <div className="absolute top-2 right-2 text-xs bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center">
                                    {badgeCount}
                                </div>
                            ) : null}
                        </Link>
                    </Button>
                  ))}
                  {user && (
                    <Button onClick={handleLogout} variant="ghost" className="flex flex-col h-16 px-4">
                        <LogOut /><span className="text-xs">Logout</span>
                    </Button>
                  )}
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
       <div className="sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
                <Button variant="default" className="fixed top-4 right-4 z-50 h-auto p-3 rounded-full shadow-lg">
                    <MoreVertical className="h-5 w-5" />
                    <span className="ml-2 font-semibold">Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
                <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2 py-4">
                {isUserLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                ) : (
                    <>
                    {navLinks.map(({ href, label, icon: Icon, badgeCount }) => (
                        <SheetClose asChild key={href}>
                             <Link href={href}>
                                <Button variant={pathname === href ? "secondary" : "default"} className="w-full justify-start relative gap-4">
                                   <div className="flex items-center gap-4">
                                        <Icon />
                                        <span>{label}</span>
                                        {badgeCount && badgeCount > 0 ? (
                                            <div className="absolute top-1/2 -translate-y-1/2 right-4 text-xs bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center">
                                                {badgeCount}
                                            </div>
                                        ) : null}
                                    </div>
                                </Button>
                            </Link>
                        </SheetClose>
                    ))}
                    {user && (
                        <SheetClose asChild>
                            <Button onClick={handleLogout} variant="destructive" className="w-full justify-start gap-4">
                                <LogOut />
                                <span>Logout</span>
                            </Button>
                        </SheetClose>
                    )}
                    </>
                )}
                </div>
            </SheetContent>
            </Sheet>
        </div>
    </>
  );
}
