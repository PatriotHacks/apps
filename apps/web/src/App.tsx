import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Sponsors from './components/Sponsors'
import Interested from './components/Interested'
import Faq from './components/Faq'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Sponsors />
        <Interested />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
