'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail, AuthError } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Mail, HelpCircle, ArrowLeft } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const getFirebaseErrorMessage = (error: AuthError) => {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  async function onSubmit(values: ForgotPasswordData) {
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'Check Your Email',
        description: `A password reset link has been sent to ${values.email}.`,
      });
      setIsSubmitted(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: getFirebaseErrorMessage(error as AuthError),
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex justify-center items-start">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/20 text-primary p-3 rounded-full w-fit mb-2">
            <HelpCircle className="h-8 w-8" />
          </div>
          <CardTitle className="font-headline text-3xl">Forgot Password</CardTitle>
          <CardDescription>
            {isSubmitted
              ? "You can close this page now."
              : "Enter your email to receive a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="text-center">
              <p className="text-muted-foreground">
                Please check your inbox (and spam folder) for an email with instructions on how to reset your password.
              </p>
              <Button asChild className="mt-6 w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                            className="pl-10"
                            autoComplete="email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        {!isSubmitted && (
            <div className="text-center text-sm text-muted-foreground p-4 border-t">
                 <Link href="/login" className="underline text-primary hover:text-accent-foreground">
                    Remembered your password? Login
                </Link>
            </div>
        )}
      </Card>
    </div>
  );
}
